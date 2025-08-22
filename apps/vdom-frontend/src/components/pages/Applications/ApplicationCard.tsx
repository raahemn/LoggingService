import { h } from "preact";
import { Application } from "./types";
import { getStatusBadge } from "../../../utils/applicationUtils";
import { AuthManager } from "../../../utils/auth";
import "ojs/ojbutton";

interface ApplicationCardProps {
  app: Application;
  onEdit: (appId: string) => void;
  onDelete: (appId: string) => void;
  isDeleting: boolean;
}

export function ApplicationCard({ app, onEdit, onDelete, isDeleting }: ApplicationCardProps) {
  const appId = app._id.toString();
  const appLogCounts = { logsToday: 10, errors: 10 };
  const statusBadge = getStatusBadge(app, appLogCounts.errors);
  
  const currentUser = AuthManager.getCurrentUser();
  const isAdmin = currentUser?.isAdmin || false;

  return (
    <div
      key={appId}
      class="oj-panel oj-panel-shadow-sm"
      style="
        flex: 1;
        min-width: 400px;
        max-width: 400px;
        padding: 20px;
        height: 250px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: white;
      "
    >
      <div class="oj-flex oj-justify-content-space-between oj-align-items-start" style="margin-bottom: 16px;">
        <div style="flex: 1;">
          <h3 style="margin: 0 0 4px 0; font-size: 1.125rem; font-weight: 600; font-family: 'Poppins', sans-serif; color: #111827;">
            {app.name}
          </h3>
          <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 0.875rem; font-family: 'Poppins', sans-serif;">
            {app.description}
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 0.75rem; font-family: 'Courier New', monospace; font-weight: 500;">
            ID: {appId}
          </p>
        </div>
        <div class="oj-flex" style="gap: 4px;">
          {/* Only show edit button if user is admin */}
          {isAdmin && (
            <oj-button
              display="icons"
              chroming="borderless"
              onojAction={() => onEdit(appId)}
              title="Edit Application"
            >
              <span slot="startIcon" class="oj-ux-ico-settings"></span>
            </oj-button>
          )}
          {/* Only show delete button if user is admin */}
          {isAdmin && (
            <oj-button
              display='icons'
              chroming='borderless'
              onojAction={() => onDelete(appId)}
              title="Delete Application"
              disabled={isDeleting}
            >
              <span slot='startIcon' class='oj-ux-ico-trash'></span>
            </oj-button>
          )}
        </div>
      </div>

      {/* Status and Last Update */}
      <div class="oj-flex oj-justify-content-space-between oj-align-items-center" style="margin-bottom: 16px; width: 100%;">
        <span class={statusBadge.class} style="font-size: 0.75rem; font-family: 'Poppins', sans-serif; padding: 4px 8px; flex-shrink: 0;">
          {statusBadge.text}
        </span>
      </div>

      {app.active && (
        <div style="border-top: 1px solid #f3f4f6; padding-top: 16px;">
          <div class="oj-flex oj-justify-content-space-between oj-align-items-center" style="margin-bottom: 8px; width: 100%;">
            <span style="color: #374151; font-size: 0.875rem; font-family: 'Poppins', sans-serif; flex-shrink: 0;">Logs today:</span>
            <span style="color: #374151; font-weight: 600; font-size: 0.875rem; font-family: 'Poppins', sans-serif; flex-shrink: 0; margin-left: auto;">
              {app.logsToday}
            </span>
          </div>
          <div class="oj-flex oj-justify-content-space-between oj-align-items-center" style="width: 100%;">
            <span style="color: #374151; font-size: 0.875rem; font-family: 'Poppins', sans-serif; flex-shrink: 0;">Errors:</span>
            <span style="color: #374151; font-weight: 600; font-size: 0.875rem; font-family: 'Poppins', sans-serif; flex-shrink: 0; margin-left: auto;">
              {app.errorsToday}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}