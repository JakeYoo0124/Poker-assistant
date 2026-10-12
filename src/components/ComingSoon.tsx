interface ComingSoonProps {
  stage: string
}

export default function ComingSoon({ stage }: ComingSoonProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
      {stage}에서 구현 예정입니다.
    </div>
  )
}
