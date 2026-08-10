import { auth } from "@/auth"; import { redirect } from "next/navigation";
export async function requireCoach(){const session=await auth();if(!session?.user?.id)redirect("/");return session.user;}
