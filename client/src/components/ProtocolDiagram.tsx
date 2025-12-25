export default function ProtocolDiagram() {
  return (
    <div className="bg-slate-100 dark:bg-slate-800/50 py-16 px-6">
      <h2 className="text-3xl font-bold text-center mb-12 text-slate-900 dark:text-white">
        Protocol Architecture
      </h2>
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 max-w-6xl mx-auto">
        <div className="flex flex-col items-center">
          <div className="bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-4 rounded-lg shadow-lg min-w-[160px] text-center">
            <div className="font-semibold">Frontend</div>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
            React + WebRTC + JWT
          </p>
        </div>

        <div className="text-4xl text-slate-400 dark:text-slate-600 rotate-90 md:rotate-0">
          ➡️
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-purple-600 dark:bg-purple-500 text-white px-6 py-4 rounded-lg shadow-lg min-w-[160px] text-center">
            <div className="font-semibold">Session Bridge</div>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center max-w-[200px]">
            Stateless JWT handoff, role claims, consent registry
          </p>
        </div>

        <div className="text-4xl text-slate-400 dark:text-slate-600 rotate-90 md:rotate-0">
          ➡️
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-green-600 dark:bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg min-w-[160px] text-center">
            <div className="font-semibold">Backend</div>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center">
            Node.js + Express + Anchoring Logic
          </p>
        </div>

        <div className="text-4xl text-slate-400 dark:text-slate-600 rotate-90 md:rotate-0">
          ➡️
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-yellow-500 dark:bg-yellow-600 text-white px-6 py-4 rounded-lg shadow-lg min-w-[160px] text-center">
            <div className="font-semibold">Ledger & Governance</div>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 text-center max-w-[200px]">
            Ethereum anchoring, receipts, proposals, voting
          </p>
        </div>
      </div>
    </div>
  );
}
