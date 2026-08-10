import { signOut } from "@/auth";
export function Header({name}:{name?:string|null}){return <nav className="topbar"><a className="brand" href="/dashboard">Coach<span>Log</span></a><div className="row"><span className="muted">{name}</span><form action={async()=>{"use server";await signOut({redirectTo:"/"})}}><button className="button light">登出</button></form></div></nav>}
