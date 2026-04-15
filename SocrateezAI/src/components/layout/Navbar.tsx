import React, { useState } from 'react';
import { Briefcase, LayoutDashboard, Search, Bot, Activity, Menu, X } from 'lucide-react';
import { Button } from '../Button';
import { cn } from '../../lib/utils';
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}
const navItems: NavItem[] = [
{
  id: 'dashboard',
  label: 'Dashboard',
  icon: <LayoutDashboard className="h-4 w-4" />
},
{
  id: 'jobs',
  label: 'Job Search',
  icon: <Search className="h-4 w-4" />
},
{
  id: 'ai',
  label: 'AI Assistant',
  icon: <Bot className="h-4 w-4" />
},
{
  id: 'etl-audit',
  label: 'ETL Audit',
  icon: <Activity className="h-4 w-4" />
}];

interface NavbarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}
export function Navbar({ activePage, onNavigate }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight text-foreground hover:opacity-80 transition-opacity">
          
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Briefcase className="h-4 w-4 text-primary-foreground" />
          </div>
          <span>JobInsight</span>
        </button>

        {/* Desktop Navigation */}
        <nav
          className="hidden md:flex items-center gap-1"
          aria-label="Main navigation">
          
          {navItems.map((item) =>
          <Button
            key={item.id}
            variant={activePage === item.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onNavigate(item.id)}
            className={cn(
              'gap-2 font-medium',
              activePage === item.id ?
              'bg-secondary text-secondary-foreground' :
              'text-muted-foreground hover:text-foreground'
            )}>
            
              {item.icon}
              {item.label}
            </Button>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}>
          
          {mobileMenuOpen ?
          <X className="h-5 w-5" /> :

          <Menu className="h-5 w-5" />
          }
        </Button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen &&
      <nav
        className="border-t bg-background px-4 py-3 md:hidden"
        aria-label="Mobile navigation">
        
          <div className="flex flex-col gap-1">
            {navItems.map((item) =>
          <Button
            key={item.id}
            variant={activePage === item.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              onNavigate(item.id);
              setMobileMenuOpen(false);
            }}
            className={cn(
              'w-full justify-start gap-2 font-medium',
              activePage === item.id ?
              'bg-secondary text-secondary-foreground' :
              'text-muted-foreground hover:text-foreground'
            )}>
            
                {item.icon}
                {item.label}
              </Button>
          )}
          </div>
        </nav>
      }
    </header>);

}