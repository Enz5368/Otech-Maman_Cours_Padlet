import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function DashboardPage() {
  if (!(await isAdmin())) redirect("/admin");
  return <AdminDashboard />;
}
