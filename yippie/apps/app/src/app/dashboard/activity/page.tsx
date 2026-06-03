export default function ActivityPage() {
  return <ComingSoon title="Activity" icon="📊" description="View stats and a full event log across your workspace." />;
}

function ComingSoon({ title, icon, description }: { title: string; icon: string; description: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h1>
      <p className="text-gray-500 text-sm">{description}</p>
      <div className="mt-8 bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <p className="text-4xl mb-3">{icon}</p>
        <p className="text-gray-400 text-sm">Coming soon</p>
      </div>
    </div>
  );
}
