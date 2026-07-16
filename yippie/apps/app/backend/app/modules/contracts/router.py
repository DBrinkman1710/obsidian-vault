from __future__ import annotations

import re
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.contracts import service
from app.modules.contracts.schemas import (
    BulkDeleteRequest,
    ContractCreate,
    ContractOut,
    ContractUpdate,
    GenerateRequest,
    RenewalsSummary,
    SignLinkOut,
    SignLinkRequest,
    TemplateCreate,
    TemplateOut,
    TemplatePreviewRequest,
    TemplateUpdate,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])
DB = Annotated[AsyncSession, Depends(get_db)]

ALLOWED_FILE_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.get("", response_model=list[ContractOut])
async def list_contracts(
    current_user: CurrentUser,
    db: DB,
    company_id: Optional[uuid.UUID] = Query(None),
    contact_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    direction: Optional[str] = Query(None),
):
    return await service.list_contracts(
        db,
        current_user.tenant_id,
        company_id=company_id,
        contact_id=contact_id,
        status=status_filter,
        direction=direction,
    )


@router.post("", response_model=ContractOut, status_code=status.HTTP_201_CREATED)
async def create_contract(body: ContractCreate, current_user: CurrentUser, db: DB):
    return await service.create_contract(db, current_user.tenant_id, current_user.id, body)


# Static paths declared before "/{contract_id}" so FastAPI does not read them as UUIDs.
@router.get("/renewals/summary", response_model=RenewalsSummary)
async def get_renewals_summary(current_user: CurrentUser, db: DB):
    """MRR/ARR + renewal counts — also consumed by the Billing module."""
    return await service.renewals_summary(db, current_user.tenant_id)


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(current_user: CurrentUser, db: DB):
    return await service.list_templates(db, current_user.tenant_id)


@router.get("/templates/fields")
async def list_merge_fields():
    """Merge fields the template editor can insert."""
    return {"fields": list(service.MERGE_FIELDS)}


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(body: TemplateCreate, current_user: CurrentUser, db: DB):
    try:
        return await service.create_template(db, current_user.tenant_id, current_user.id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/templates/preview")
async def preview_template(body: TemplatePreviewRequest, current_user: CurrentUser, db: DB):
    """Render unsaved blocks as a sample contract PDF — the builder's preview."""
    from app.core.doc_blocks import (
        resolve_merge_fields_in_blocks,
        sample_contract_values,
        validate_blocks,
    )
    from app.core.doc_blocks_pdf import RenderContext, render_blocks_pdf
    from app.core.models import Tenant

    try:
        doc = validate_blocks(body.blocks, "contract")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    tenant = await db.get(Tenant, current_user.tenant_id)
    tenant_name = tenant.name if tenant else ""
    resolved = resolve_merge_fields_in_blocks(doc, sample_contract_values(tenant_name))
    data = render_blocks_pdf(
        resolved,
        RenderContext(
            doc_type="contract",
            tenant=tenant,
            tenant_name=tenant_name,
            primary_color=getattr(tenant, "primary_color", None),
        ),
    )
    return StreamingResponse(
        iter([data]),
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="template_preview.pdf"'},
    )


@router.get("/templates/{template_id}", response_model=TemplateOut)
async def get_template(template_id: uuid.UUID, current_user: CurrentUser, db: DB):
    template = await service.get_template(db, current_user.tenant_id, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.patch("/templates/{template_id}", response_model=TemplateOut)
async def update_template(template_id: uuid.UUID, body: TemplateUpdate, current_user: CurrentUser, db: DB):
    try:
        template = await service.update_template(db, current_user.tenant_id, template_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/templates/{template_id}")
async def delete_template(template_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ok = await service.delete_template(db, current_user.tenant_id, template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}


@router.delete("/bulk")
async def bulk_delete_contracts(body: BulkDeleteRequest, current_user: CurrentUser, db: DB):
    deleted = await service.bulk_delete(db, current_user.tenant_id, body.ids)
    return {"deleted": deleted}


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    contract = await service.get_contract(db, current_user.tenant_id, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.patch("/{contract_id}", response_model=ContractOut)
async def update_contract(contract_id: uuid.UUID, body: ContractUpdate, current_user: CurrentUser, db: DB):
    contract = await service.update_contract(db, current_user.tenant_id, contract_id, body)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.delete("/{contract_id}")
async def delete_contract(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ok = await service.delete_contract(db, current_user.tenant_id, contract_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Contract not found")
    return {"deleted": True}


@router.post("/{contract_id}/generate", response_model=ContractOut)
async def generate_from_template(
    contract_id: uuid.UUID, body: GenerateRequest, current_user: CurrentUser, db: DB
):
    """Render a template's merge fields into the contract's frozen body."""
    from app.core.models import Tenant

    tenant = await db.get(Tenant, current_user.tenant_id)
    contract = await service.generate_body(
        db, current_user.tenant_id, contract_id, body.template_id,
        tenant.name if tenant else "",
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract or template not found")
    return contract


@router.post("/{contract_id}/signing", response_model=SignLinkOut)
async def create_signing_link(
    contract_id: uuid.UUID, body: SignLinkRequest, current_user: CurrentUser, db: DB
):
    """Create the public /sign/:token link. Requires a generated body."""
    contract = await service.create_sign_link(db, current_user.tenant_id, contract_id, body.expires_days)
    if not contract:
        raise HTTPException(
            status_code=400,
            detail="Generate the contract text first — and a signed contract cannot be re-sent",
        )
    return SignLinkOut(sign_token=contract.sign_token, sign_token_expires_at=contract.sign_token_expires_at)


@router.get("/{contract_id}/pdf")
async def download_pdf(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    from app.core.models import Tenant
    from app.modules.contracts.pdf import generate_contract_pdf

    contract = await service.get_for_pdf(db, current_user.tenant_id, contract_id)
    if not contract or not (contract.body or contract.rendered_blocks):
        raise HTTPException(status_code=404, detail="No generated contract text to render")
    tenant = await db.get(Tenant, current_user.tenant_id)
    if contract.rendered_blocks:
        # [TMPL1] block layout, frozen at generation time — already merge resolved.
        from app.core.doc_blocks import BlockDocument
        from app.core.doc_blocks_pdf import RenderContext, SignatureData, render_blocks_pdf

        data = render_blocks_pdf(
            BlockDocument.model_validate(contract.rendered_blocks),
            RenderContext(
                doc_type="contract",
                tenant=tenant,
                tenant_name=tenant.name if tenant else "",
                primary_color=getattr(tenant, "primary_color", None),
                notes=contract.notes,
                signature=SignatureData(
                    signed_at=contract.signed_at,
                    signer_name=contract.signer_name,
                    signer_ip=contract.signer_ip,
                    signature_image=getattr(contract, "signature_image", None),
                ),
            ),
        )
    else:
        data = generate_contract_pdf(
            contract, tenant.name if tenant else "", getattr(tenant, "primary_color", None)
        )
    safe_name = re.sub(r'[^\w.]', '_', contract.title)[:60] or "contract"
    return StreamingResponse(
        iter([data]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )


@router.post("/{contract_id}/file", response_model=ContractOut)
async def upload_file(
    contract_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    file: UploadFile = File(...),
):
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF, Word, or image files are supported")
    data = await file.read()
    if len(data) > service.MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="File is larger than 15 MB")
    if not data:
        raise HTTPException(status_code=400, detail="File is empty")
    contract = await service.set_file(
        db,
        current_user.tenant_id,
        contract_id,
        data=data,
        file_name=file.filename or "contract",
        file_type=file.content_type,
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.delete("/{contract_id}/file", response_model=ContractOut)
async def delete_file(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    contract = await service.clear_file(db, current_user.tenant_id, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.get("/{contract_id}/file")
async def download_file(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    contract = await service.get_file(db, current_user.tenant_id, contract_id)
    if not contract or not contract.file_data:
        raise HTTPException(status_code=404, detail="No file attached")
    safe_name = re.sub(r'[^\w\-.]', '_', contract.file_name or "contract")[:80]
    return StreamingResponse(
        iter([contract.file_data]),
        media_type=contract.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )
