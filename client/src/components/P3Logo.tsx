export default function P3Logo({ className = "w-32", showTagline = true }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={`${className} flex flex-col items-center justify-center`}>
      <div className="text-center select-none">
        <div className="text-6xl font-black text-slate-900 dark:text-white tracking-tight">
          P3
        </div>
        <div className="text-xs font-bold text-slate-900 dark:text-white border-t border-b border-slate-400 dark:border-slate-500 py-1 my-1 tracking-widest">
          {"{PROTOCOL}"}
        </div>
        <div className="text-[7px] font-mono text-slate-500 dark:text-slate-400 tracking-wide leading-tight">
          <div>60 29017S DA 110C2CS1U7</div>
          <div>DEMPER 9D2 QJBJ7 ZSC1</div>
        </div>
        {showTagline && (
          <div className="text-[9px] font-bold text-slate-900 dark:text-white mt-2 tracking-tight uppercase">
            Privacy Preserving Proof
          </div>
        )}
      </div>
    </div>
  );
}
