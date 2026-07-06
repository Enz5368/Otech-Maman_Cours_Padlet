import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminLogin } from "@/components/admin/AdminLogin";

export default async function AdminPage() {
  if (await isAdmin()) redirect("/admin/dashboard");
  return <AdminLogin />;
}
