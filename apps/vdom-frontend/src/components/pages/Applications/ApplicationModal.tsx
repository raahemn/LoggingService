import { h } from "preact";
import "oj-c/button";
import 'ojs/ojswitch';

interface ApplicationModalProps {
  showModal: boolean;
  isEditing: boolean;
  editingAppId?: string | null;
  newAppName: string;
  newAppDescription: string;
  newAppActive: boolean;
  nameError: string | null;
  descriptionError: string | null;
  formError: string | null;
  isProcessing: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
}

export function ApplicationModal({
  showModal,
  isEditing,
  editingAppId,
  newAppName,
  newAppDescription,
  newAppActive,
  nameError,
  descriptionError,
  formError,
  isProcessing,
  isCreating,
  isUpdating,
  onClose,
  onSave,
  onNameChange,
  onDescriptionChange,
  onActiveChange,
}: ApplicationModalProps) {
  if (!showModal) return null;

  return (
    <div class="modal-overlay" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    ">
      <div class="modal-content oj-panel" style="
        background: white;
        border-radius: 8px;
        padding: 24px;
        width: 500px;
        max-width: 90vw;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      ">
        <div style="margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 600; color: #111827; font-family: 'Poppins', sans-serif;">
            {isEditing ? 'Edit Application' : 'Add New Application'}
          </h2>
          <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 0.875rem; font-family: 'Poppins', sans-serif;">
            {isEditing ? 'Update the application details' : 'Enter the details for your new application'}
          </p>
          {isEditing && editingAppId && (
            <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 0.75rem; font-family: 'Courier New', monospace; font-weight: 500;">
              ID: {editingAppId}
            </p>
          )}
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 0.875rem; font-family: 'Poppins', sans-serif;">
            Application Name *
          </label>
          <input
            type="text"
            value={newAppName}
            onInput={(e) => onNameChange((e.target as HTMLInputElement).value)}
            placeholder="Enter application name"
            style="
              width: 100%;
              padding: 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.875rem;
              font-family: 'Poppins', sans-serif;
              box-sizing: border-box;
            "
          />
          {nameError && (
            <div style="color: #b91c1c; font-size: 0.75rem; margin-top: 4px; font-family: 'Poppins', sans-serif;">
              {nameError}
            </div>
          )}
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 0.875rem; font-family: 'Poppins', sans-serif;">
            Description *
          </label>
          <textarea
            value={newAppDescription}
            onInput={(e) => onDescriptionChange((e.target as HTMLTextAreaElement).value)}
            placeholder="Enter application description"
            rows={3}
            style="
              width: 100%;
              padding: 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.875rem;
              font-family: 'Poppins', sans-serif;
              resize: vertical;
              box-sizing: border-box;
            "
          />
          <div class="oj-flex oj-justify-content-space-between oj-align-items-start" style="margin-top: 4px;">
            {descriptionError && (
              <div style="color: #b91c1c; font-size: 0.75rem; font-family: 'Poppins', sans-serif;">
                {descriptionError}
              </div>
            )}
            <div style="color: #9ca3af; font-size: 0.75rem; font-family: 'Poppins', sans-serif; margin-left: auto;">
              {newAppDescription.length} /100 characters
            </div>
          </div>
        </div>

        {isEditing && (
          <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 0.875rem; font-family: 'Poppins', sans-serif;">
              Status
            </label>
            <div class="oj-flex oj-align-items-center" style="gap: 12px;">
              <div class="oj-flex oj-align-items-center" style="gap: 8px;">
                <oj-switch
                  value={newAppActive}
                  onvalueChanged={(event) => onActiveChange(event.detail.value ?? false)}
                />
              </div>
              <span style="color: #6b7280; font-size: 0.8rem; font-family: 'Poppins', sans-serif; margin-top: 8px;">
                {newAppActive ? 'Application is currently active and receiving logs' : 'Application is inactive and not receiving logs'}
              </span>
            </div>
          </div>
        )}

        {formError && (
          <div style="
            margin-bottom: 16px;
            background-color: #fef2f2;
            color: #b91c1c;
            padding: 12px;
            border: 1px solid #fca5a5;
            border-radius: 6px;
            font-size: 0.875rem;
            font-family: 'Poppins', sans-serif;
          ">
            {formError}
          </div>
        )}

        <div class="oj-flex oj-justify-content-flex-end" style="gap: 12px; justify-content: flex-end;">
          <oj-button
            onojAction={onClose}
            disabled={isProcessing}
            style="--oj-button-text-color: white; border: none;"
          >
            Cancel
          </oj-button>
          <oj-button
            class="oj-button-primary"
            onojAction={onSave}
            disabled={isProcessing}
            style="--oj-button-text-color: white; border: none;"
          >
            {isEditing
              ? isUpdating ? 'Updating...' : 'Update Application'
              : isCreating ? 'Creating...' : 'Create Application'}
          </oj-button>
        </div>
      </div>
    </div>
  );
}