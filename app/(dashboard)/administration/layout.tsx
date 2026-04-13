import { AdminSidebar } from "./_components/AdminSidebar"

export default function AdministrationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-8rem)]">
      <AdminSidebar />
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
