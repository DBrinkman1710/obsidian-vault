import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "DBrinkman1710";
const REPO_NAME = "obsidian-vault";
const FILE_PATH = "yippie/client-pipeline.md";
const BRANCH = "claude/modular-account-management-design-XrQwj";

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, phone } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const date = new Date().toISOString().slice(0, 10);
    const newRow = `| ${date} | ${name} | ${email} | ${company ?? ""} | ${phone ?? ""} |\n`;

    const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };

    // Fetch existing file (if any)
    let existingSha: string | undefined;
    let existingContent = "";

    const getRes = await fetch(`${apiBase}?ref=${BRANCH}`, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      existingSha = data.sha;
      existingContent = Buffer.from(data.content, "base64").toString("utf-8");
    } else if (getRes.status !== 404) {
      return NextResponse.json({ error: "Failed to read pipeline doc." }, { status: 502 });
    }

    // Build updated content
    let updatedContent: string;
    if (!existingContent) {
      updatedContent =
        "# Client Pipeline\n\n" +
        "| Date | Name | Email | Company | Phone |\n" +
        "|------|------|-------|---------|-------|\n" +
        newRow;
    } else {
      updatedContent = existingContent + newRow;
    }

    // Commit
    const body: Record<string, string> = {
      message: `chore: add signup — ${name} (${email})`,
      content: Buffer.from(updatedContent).toString("base64"),
      branch: BRANCH,
    };
    if (existingSha) body.sha = existingSha;

    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      console.error("GitHub PUT failed:", err);
      return NextResponse.json({ error: "Failed to save signup." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
