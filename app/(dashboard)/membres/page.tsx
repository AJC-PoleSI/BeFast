import { getAllMembers, getAllRoles } from "@/lib/actions/members"
import { MembresClient } from "./_components/MembresClient"

export default async function MembresPage() {
  const [membersRes, rolesRes] = await Promise.all([getAllMembers(), getAllRoles()])
  return (
    <MembresClient
      initialMembers={membersRes.data ?? []}
      initialRoles={rolesRes.data ?? []}
    />
  )
}
