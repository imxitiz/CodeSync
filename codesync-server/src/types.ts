// Shared backend types — imported by socket handlers and the repository.

export type UserPermissions = {
	canEdit: boolean;
	canCreateTab: boolean;
	canDeleteTab: boolean;
	canRenameTab: boolean;
};

export type TabData = { name: string; code: string };

// Wire format for the TAB_SYNC event (Array form sent over the socket).
export type SerializedTab = { id: string; name: string; code: string };

// Wire format for clients list in the JOINED event.
export type ClientEntry = { socketId: string; username: string };

// Wire format for userActiveTabs in the TAB_SYNC event.
export type UserActiveTab = { username: string; activeTabId: string };
