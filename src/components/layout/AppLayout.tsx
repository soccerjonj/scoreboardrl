import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import TopNav from "./TopNav";

const AppLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background">
    <TopNav />
    <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
      {children}
    </main>
    <BottomNav />
  </div>
);

export default AppLayout;
