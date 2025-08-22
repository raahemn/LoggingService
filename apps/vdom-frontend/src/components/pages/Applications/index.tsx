import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { useApplications, useCreateApplication, useUpdateApplication, useDeleteApplication } from "../../../hooks/useApplications";
import { validateApplicationForm } from "../../../utils/applicationUtils";
import { OriginalFormValues, ApplicationFilters } from "./types";

// Components
import { NotificationBanner } from "./NotificationBanner";
import { ApplicationFiltersComponent } from "./ApplicationFilters";
import { ApplicationCard } from "./ApplicationCard";
import { ApplicationPagination } from "./ApplicationPagination";
import { ApplicationModal } from "./ApplicationModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { DiscardChangesModal } from "./DiscardChangesModal";
import { AuthManager } from "../../../utils/auth";

import "oj-c/button";
import "oj-c/progress-circle";

export function Applications() {
  const { applications, loading, dataLoading, pagination, currentFilters, currentSearchTerm, actions } = useApplications({ pageSize: 6 });
  const { createApplication, isCreating } = useCreateApplication();
  const { updateApplication, isUpdating } = useUpdateApplication();
  const { deleteApplication, isDeleting } = useDeleteApplication();

  // Modal states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newAppName, setNewAppName] = useState<string>('');
  const [newAppDescription, setNewAppDescription] = useState<string>('');
  const [newAppActive, setNewAppActive] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);

  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const [originalFormValues, setOriginalFormValues] = useState<OriginalFormValues | null>(null);

  // Error states
  const [formError, setFormError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Success states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletedApplication, setDeletedApplication] = useState<{ name: string } | null>(null);

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [applyingFilters, setApplyingFilters] = useState<boolean>(false);
  const [searchTimeout, setSearchTimeout] = useState<number | null>(null);

  const currentUser = AuthManager.getCurrentUser();
  const isAdmin = currentUser?.isAdmin || false;

  const hasFormChanges = (): boolean => {
    if (!originalFormValues) return false;
    
    return (
      newAppName.trim() !== originalFormValues.name ||
      newAppDescription.trim() !== originalFormValues.description ||
      newAppActive !== originalFormValues.active
    );
  };

  const handleAddApplication = () => {
    const defaultValues = {
      name: '',
      description: '',
      active: true
    };
    
    setOriginalFormValues(defaultValues);
    setShowModal(true);
    setNewAppName(defaultValues.name);
    setNewAppDescription(defaultValues.description);
    setNewAppActive(defaultValues.active); 
  };

  const handleCloseModal = () => {
    if (hasFormChanges()) {
      setShowDiscardConfirm(true);
    } else {
      performCloseModal();
    }
  };

  const performCloseModal = () => {
    setShowModal(false);
    setNewAppName('');
    setNewAppDescription('');
    setNewAppActive(true);
    setEditingAppId(null);
    setIsEditing(false);
    setFormError(null);
    setNameError(null);
    setDescriptionError(null);
    setOriginalFormValues(null);
  };

  const handleDiscardChanges = () => {
    setShowDiscardConfirm(false);
    performCloseModal();
  };

  const handleCancelDiscard = () => {
    setShowDiscardConfirm(false);
  };

  const handleSaveApplication = async () => {
    setNameError(null);
    setDescriptionError(null);
    setFormError(null);

    const { isValid, errors } = validateApplicationForm(newAppName, newAppDescription);
    
    setNameError(errors.name || null);
    setDescriptionError(errors.description || null);

    if (!isValid) return;

    try {
      if (isEditing && editingAppId) {
        await updateApplication(editingAppId, {
          name: newAppName.trim(),
          description: newAppDescription.trim(),
          active: newAppActive, 
        });

        await actions.refreshCurrentPage();
        setSuccessMessage(`Application "${newAppName.trim()}" has been updated successfully.`);
      } else {
        await createApplication({
          name: newAppName.trim(),
          description: newAppDescription.trim(),
        });

        await actions.refreshCurrentPage();
        setSuccessMessage(`Application "${newAppName.trim()}" has been created successfully.`);
      }

      performCloseModal();
    } catch (error: unknown) {
      const message = (error as Error)?.message || 'Failed to save application. Please try again.';
      setFormError(message);
    }
  };

  const handleApplicationSettings = (appId: string) => {
    const app = applications.find(app => app._id === appId);
    if (!app) return;

    const originalValues = {
      name: app.name,
      description: app.description,
      active: app.active ?? true
    };

    setOriginalFormValues(originalValues);
    setEditingAppId(appId);
    setNewAppName(originalValues.name);
    setNewAppDescription(originalValues.description);
    setNewAppActive(originalValues.active); 
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDeleteApplication = (appId: string) => {
    setDeletingAppId(appId);
    setShowDeleteConfirm(true);
  };

  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeletingAppId(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAppId) return;
    setDeleteError(null);

    try {
      const appToDelete = applications.find(app => app._id === deletingAppId);
      
      await deleteApplication(deletingAppId);
      await actions.refreshCurrentPage();
      
      if (appToDelete) {
        setDeletedApplication({ name: appToDelete.name });
      }
      
      handleCloseDeleteConfirm();
    } catch (error) {
      const message = (error as Error)?.message || 'Failed to delete application. Please try again.';
      setDeleteError(message);
    }
  };

  const handleFilterChange = async (event: any) => {
    const newStatus = event.detail.value;
    setFilterStatus(newStatus);
    setApplyingFilters(true);
    
    try {
      const filters: ApplicationFilters = {};
      
      if (newStatus === 'active') {
        filters.active = true;
      } else if (newStatus === 'inactive') {
        filters.active = false;
      }
      
      // Apply filters with current search term
      await actions.fetchApplicationsWithFilters(filters, searchQuery);
    } catch (error) {
      console.error('Error applying filter:', error);
    } finally {
      setApplyingFilters(false);
    }
  };

  const handleSearchChange = (event: any) => {
    const value = event.detail.value || '';
    setSearchQuery(value);
    
    // Clear previous timeout if user is still typing
    if (searchTimeout) {
      window.clearTimeout(searchTimeout);
    }
    
    // Debounce search to avoid too many API calls
    const timeout = window.setTimeout(async () => {
      try {
        await actions.fetchApplicationsWithSearch(value);
      } catch (error) {
        console.error('Error searching applications:', error);
      }
    }, 500); // 500ms delay
    
    setSearchTimeout(timeout);
  };

  const clearSearch = () => {
    if (searchTimeout) {
      window.clearTimeout(searchTimeout);
      setSearchTimeout(null);
    }
    
    setSearchQuery('');
    
    actions.fetchApplicationsWithSearch('');
  };

  useEffect(() => {
    return () => {
      if (searchTimeout) {
        window.clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const handlePageChange = async (page: number) => {
    await actions.goToPage(page);
  };

  const handleFirstPage = async () => {
    await actions.goToFirstPage();
  };

  const handlePrevPage = async () => {
    await actions.goToPrevPage();
  };

  const handleNextPage = async () => {
    await actions.goToNextPage();
  };

  const handleLastPage = async () => {
    await actions.goToLastPage();
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (deletedApplication) {
      const timer = setTimeout(() => {
        setDeletedApplication(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deletedApplication]);

  const isProcessing = isCreating || isUpdating || isDeleting;

  const renderEmptyState = () => {
    const hasSearchQuery = searchQuery.trim() !== '';
    const hasFilters = Object.keys(currentFilters).length > 0;

    const getTitle = () => {
      if (hasSearchQuery) {
        return `No applications found"`;
      }
      if (hasFilters) {
        const filterText = currentFilters.active === true ? 'active' : 
                          currentFilters.active === false ? 'inactive' : '';
        return `No ${filterText} applications found`;
      }
      return 'No applications found';
    };

    const getSubtitle = () => {
      if (hasSearchQuery) {
        return 'Try adjusting your search terms.';
      }
      if (hasFilters) {
        return 'Try changing the filter or add a new application.';
      }
      return 'Click "Add Application" to get started.';
    };

    return (
      <div class="oj-flex oj-justify-content-center oj-align-items-center" style="height: 200px;">
        <div style="text-align: center;">
          <h3 style="color: #6b7280; margin-bottom: 8px;">
            {getTitle()}
          </h3>
          <p style="color: #9ca3af;">
            {getSubtitle()}
          </p>
        </div>
      </div>
    );
  };

  const renderApplicationsGrid = () => {
    if (dataLoading) {
      return (
        <div class="oj-flex oj-justify-content-center oj-align-items-center" style="min-height: 400px;">
          <div style="text-align: center;">
            <oj-c-progress-circle
              size="lg"
              value={-1}
              style="width: 48px; height: 48px; margin-bottom: 16px;"
            ></oj-c-progress-circle>
            <p style="color: #6b7280; margin: 0;">Loading applications...</p>
          </div>
        </div>
      );
    }

    if (applications.length === 0) {
      return renderEmptyState();
    }

    return (
      <div class="oj-flex oj-flex-wrap" style="gap: 24px; min-height: 400px;">
        {applications.map(app => (
          <ApplicationCard
            key={app._id}
            app={app}
            onEdit={handleApplicationSettings}
            onDelete={handleDeleteApplication}
            isDeleting={isDeleting}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div class="oj-sm-12 oj-flex oj-sm-justify-content-center oj-sm-padding-8x">
        <div class="oj-flex oj-sm-flex-direction-column oj-sm-flex-items-center">
          <div class="oj-typography-heading-md oj-sm-margin-2x-bottom">Loading Applications...</div>
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <oj-c-progress-circle
              class="oj-sm-margin-4x-vertical oj-sm-padding-4x"
              aria-labelledby="lgLabel indetLabel"
              size="lg"
              value={-1}
            ></oj-c-progress-circle>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="oj-web-applayout-page" style="padding: 40px;">
      {/* Notifications */}
      <NotificationBanner
        message={successMessage}
        onClose={() => setSuccessMessage(null)}
        type="success"
      />

      <NotificationBanner
        message={deletedApplication ? `Application "${deletedApplication.name}" has been deleted.` : null}
        onClose={() => setDeletedApplication(null)}
        type="success"
      />

      {/* Header */}
      <div class="oj-flex oj-justify-content-space-between oj-align-items-start" style="margin-bottom: 24px;">
        <div style="flex: 1;">
          <h1 class="oj-typography-heading-lg" style="margin: 0;">
            Applications
          </h1>

          <div class="oj-flex oj-align-items-center" style="margin-top: 4px; gap: 8px;">
            <p class="oj-typography-body-md" style="color: #6b7280; margin-top: 4px;">
               Manage and monitor all your connected applications. ({pagination.totalCount} total)
              {dataLoading && " • Updating..."}
            </p>
          </div>

        </div>
        <div style="flex-shrink: 0; margin-left: 16px;">
          {isAdmin && <oj-button
            class="oj-button-primary custom-add-button"
            onojAction={handleAddApplication}
            style="--oj-button-bg-color: #6366f1 !important; border: 0px !important; --oj-button-text-color: white !important; border-radius: 8px !important;"
            disabled={dataLoading}
          >
            <span slot="startIcon" class="oj-ux-ico-plus"></span>
            Add Application
          </oj-button>}
        </div>
      </div>

      {/* Filters */}
      <ApplicationFiltersComponent
        searchQuery={searchQuery}
        filterStatus={filterStatus}
        currentFilters={currentFilters}
        applyingFilters={applyingFilters || dataLoading} // Show applying state during data loading
        onSearchChange={handleSearchChange}
        onFilterChange={handleFilterChange}
        onClearSearch={clearSearch}
      />

      {/* Applications Grid - now with conditional loading */}
      {renderApplicationsGrid()}

      {/* Pagination - disable during data loading */}
      {applications.length > 0 && !dataLoading && (
        <ApplicationPagination
          pagination={pagination}
          currentFilters={currentFilters}
          searchQuery={searchQuery}
          onPageChange={handlePageChange}
          onFirstPage={handleFirstPage}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onLastPage={handleLastPage}
          // disabled={dataLoading} // Disable pagination during data loading
        />
      )}

      {/* Modals - keep existing modal code unchanged */}
      <ApplicationModal
        showModal={showModal}
        isEditing={isEditing}
        editingAppId={editingAppId}
        newAppName={newAppName}
        newAppDescription={newAppDescription}
        newAppActive={newAppActive}
        nameError={nameError}
        descriptionError={descriptionError}
        formError={formError}
        isProcessing={isProcessing}
        isCreating={isCreating}
        isUpdating={isUpdating}
        onClose={handleCloseModal}
        onSave={handleSaveApplication}
        onNameChange={setNewAppName}
        onDescriptionChange={setNewAppDescription}
        onActiveChange={setNewAppActive}
      />

      <DeleteConfirmationModal
        showDeleteConfirm={showDeleteConfirm}
        deleteError={deleteError}
        isDeleting={isDeleting}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />

      <DiscardChangesModal
        showDiscardConfirm={showDiscardConfirm}
        onConfirm={handleDiscardChanges}
        onCancel={handleCancelDiscard}
      />
    </div>
  );
}