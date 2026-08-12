import { getCurrentAppUser } from "@/lib/auth";
import { Logo } from "./Logo";
import { HeaderActions } from "./HeaderActions";

export async function Header() {
  const user = await getCurrentAppUser();
  return (
    <>
      <div className="topbar">Frete grátis acima de R$ 699 <span>•</span> Compra segura</div>
      <header className="site-header">
        <div className="site-header__inner">
          <Logo />
          <HeaderActions signedIn={Boolean(user)} />
        </div>
      </header>
    </>
  );
}

