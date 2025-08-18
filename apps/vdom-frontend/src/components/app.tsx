import { registerCustomElement } from "ojs/ojvcomponent";
import { useEffect } from "preact/hooks";
import Context = require("ojs/ojcontext");
import SocketService from "../services/socketService";
import { Footer } from "./footer";
import { Header } from "./header";
import { Applications } from "./pages/Applications/index";
import { Sidebar } from "./sidebar";
import { UserGroups } from "./pages/UserGroups/UserGroups";
import { Dashboard } from "./pages/Dashboard/index";
import { Analytics } from "./pages/Analytics/index";
import { Login } from "./pages/Login/index";
import { Settings } from "./pages/Settings/index";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAppState } from "../hooks/useAppState";
import { RouteConfig } from "./router";
import "oj-c/button";

type Props = Readonly<{
  appName?: string;
  userLogin?: string;
}>;

export const App = registerCustomElement(
  "app-root",
  ({ appName = "Log Stream", userLogin = "john.hancock@oracle.com" }: Props) => {

    
    
    const routes: RouteConfig[] = [
      {
        path: '/',
        component: () => (
          <ProtectedRoute 
            requireAuth={true}
            onRedirect={appState.actions.handleRedirect}
          >
            <Dashboard />
          </ProtectedRoute>
        ),
        label: 'Dashboard',
        icon: 'oj-ux-ico-dashboard',
        requireAuth: true
      },
      {
        path: '/applications',
        component: () => (
          <ProtectedRoute 
            requireAuth={true}
            onRedirect={appState.actions.handleRedirect}
          >
            <Applications />
          </ProtectedRoute>
        ),
        label: 'Applications',
        icon: 'oj-ux-ico-applications',
        requireAuth: true
      },
      {
        path: '/analytics',
        component: () => (
          <ProtectedRoute 
            requireAuth={true}
            onRedirect={appState.actions.handleRedirect}
          >
            <Analytics />
          </ProtectedRoute>
        ),
        label: 'Analytics',
        icon: 'oj-ux-ico-analytics',
        requireAuth: true
      },
      {
        path: '/user-groups',
        component: () => (
          <ProtectedRoute 
            requireAuth={true}
            requireAdmin={true}
            onRedirect={appState.actions.handleRedirect}
          >
            <UserGroups />
          </ProtectedRoute>
        ),
        label: 'User Groups',
        icon: 'oj-ux-ico-group',
        requireAuth: true,
        requireAdmin: true
      },
      {
        path: '/login',
        component: () => <Login loginSuccess={appState.actions.handleLoginSuccess} />,
        label: 'Login',
        icon: 'oj-ux-ico-login',
        requireAuth: false
      },
      {
        path: '/settings',
        component: () => (
          <ProtectedRoute 
            requireAuth={true}
            requireAdmin={true}
            onRedirect={appState.actions.handleRedirect}
          >
            <Settings />
          </ProtectedRoute>
        ),
        label: 'Settings',
        icon: 'oj-ux-ico-settings',
        requireAuth: true,
        requireAdmin: true
      }
    ];

    const appState = useAppState({
      routes,
      defaultUserLogin: userLogin,
      appName
    });

    useEffect(() => {
      Context.getPageContext().getBusyContext().applicationBootstrapComplete();
    }, []);

    useEffect(() => {
      try {
        SocketService.init();
      } catch (err) {
        console.error(err);
      }

      return () => {
        SocketService.disconnect();
      };
    }, [appState.isAuthenticated]);


    if (!appState.isInitialized) {
      return (
        <div id="appContainer" class="oj-web-applayout-page">
          <div class="oj-flex oj-justify-content-center oj-align-items-center" style="height: 100vh;">
            <span>Loading...</span>
          </div>
        </div>
      );
    }

    if (!appState.isAuthenticated) {
      return (
        <div id="appContainer" class="oj-web-applayout-page">
          <div style="transition: opacity 0.2s ease-in-out;">
            <Login loginSuccess={appState.actions.handleLoginSuccess} />
          </div>
        </div>
      );
    }

    return (
      <div id="appContainer" class="oj-web-applayout-page" style="height: 100vh; display: flex; flex-direction: column;">
        <div style="position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: white; border-bottom: 1px solid #e5e7eb;">
          <Header 
            appName={appState.appName}
            userLogin={appState.currentUser} 
            onToggleDrawer={appState.actions.toggleDrawer}
            onLogout={appState.actions.handleLogout}
            isAuthenticated={appState.isAuthenticated}
          />
        </div>

        <div style="margin-top: 52px; flex: 1; overflow: hidden;">
          <Sidebar 
            isOpen={appState.isDrawerOpen}
            routes={appState.visibleRoutes}
            currentPath={appState.currentPath}
            onNavigate={appState.actions.navigate}
          >
            <div style="transition: opacity 0.2s ease-in-out;">
              {appState.currentComponent || (
                <ProtectedRoute 
                  requireAuth={true} 
                  onRedirect={appState.actions.handleRedirect}
                >
                  <Dashboard />
                </ProtectedRoute>
              )}
            </div>
          </Sidebar>
        </div>

              {/* TODO: Implement Footer */}
        {/* <Footer /> */}
      </div>
    );
  }
);