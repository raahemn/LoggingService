
import { h } from "preact";
import { useRef, useState, useEffect } from "preact/hooks";
import * as ResponsiveUtils from "ojs/ojresponsiveutils";
import { AuthManager } from "../utils/auth";
import "ojs/ojtoolbar";
import "ojs/ojmenu";
import "ojs/ojbutton";
import "oj-c/button";
import { Notifications } from "./notifications";
import { Chatbot } from "./chatbot";

type Props = Readonly<{
  appName: string,
  userLogin: string,
  onLogout?: () => void,
  onToggleDrawer: () => void,
  isAuthenticated?: boolean
}>;

export function Header({ appName, userLogin, onLogout,  onToggleDrawer, isAuthenticated = false }: Props) {
  const mediaQueryRef = useRef<MediaQueryList>(window.matchMedia(ResponsiveUtils.getFrameworkQuery("sm-only")!));
  
  const [isSmallWidth, setIsSmallWidth] = useState(mediaQueryRef.current.matches);

  useEffect(() => {
    mediaQueryRef.current.addEventListener("change", handleMediaQueryChange);
    return (() => mediaQueryRef.current.removeEventListener("change", handleMediaQueryChange));
  }, [mediaQueryRef]);

  function handleMediaQueryChange(e: MediaQueryListEvent) {
    setIsSmallWidth(e.matches);
  }

  function getDisplayType() {
    return (isSmallWidth ? "icons" : "all");
  };

  function getEndIconClass() {
    return (isSmallWidth ? "oj-icon demo-appheader-avatar" : "oj-component-icon oj-button-menu-dropdown-icon");
  }

  function handleMenuAction(event: any) {
    const value = event.detail.selectedValue;
    if (value === 'out' && onLogout) {
      onLogout();
    }
  }

  // Get user role for display
  function getUserRole(): string {
    const user = AuthManager.getCurrentUser();
    return user?.isAdmin ? 'Admin' : 'User';
  }

  // Get user name for header display
  function getUserName(): string {
    const user = AuthManager.getCurrentUser();
    // Extract name from email (part before @) or use email if no name available
    if (user?.email) {
      const name = user.name || user.email.split('@')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return userLogin;
  }

  return (
    <header role="banner" class="oj-web-applayout-header">
      <div class="oj-flex-bar oj-sm-align-items-center" style="width: 100%;">
        <div class="oj-flex-bar-start" style="display: flex; align-items: center;" >
          <oj-c-button display="icons" onojAction={onToggleDrawer} label="Toggle Menu" style="margin-right: 10px;">
            <span slot="startIcon" className="oj-ux-ico-menu"></span>
          </oj-c-button>
          <h6 class="oj-typography-heading-sm oj-sm-margin-0">LogStream</h6>
        </div>
        <div class="oj-flex-bar-middle oj-sm-align-items-baseline oj-web-applayout-max-width">
        </div>
        <div class="oj-flex-bar-end" style="padding-right: 0; margin-right: 0; display: flex; align-items: center;">
          <Notifications />
          <Chatbot />
          <oj-toolbar>
            <oj-menu-button id="userMenu" display={getDisplayType()} chroming="borderless">
              <span>{getUserName()}</span>
              <span slot="endIcon" class={getEndIconClass()}></span>
              <oj-menu id="menu1" slot="menu" onojMenuAction={handleMenuAction}>
                <oj-option id="userInfo" value="userInfo" disabled>
                  <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                    <div style="color: #111827; font-weight: 500; font-size: 0.875rem; margin-bottom: 2px;">
                      {userLogin}
                    </div>
                    <div style="color: #6b7280; font-size: 0.75rem;">
                      {getUserRole()}
                    </div>
                  </div>
                </oj-option>
                <oj-option id="out" value="out">Sign Out</oj-option>
              </oj-menu>
            </oj-menu-button>
          </oj-toolbar>
        </div>
      </div>
    </header>
  );  
}
