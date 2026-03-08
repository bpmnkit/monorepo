export type FileType = "bpmn" | "dmn" | "form";

export interface WorkspaceRecord {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
}

export interface ProjectRecord {
	id: string;
	workspaceId: string;
	name: string;
	createdAt: number;
	updatedAt: number;
}

export interface FileRecord {
	id: string;
	projectId: string;
	/** Denormalized from project — avoids extra joins in workspace-level queries. */
	workspaceId: string;
	name: string;
	type: FileType;
	/** When true this file is accessible cross-workspace for reference resolution. */
	isShared: boolean;
	/** Reserved for future GitHub sync — maps to `workspace/project/file.ext`. */
	gitPath: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface FileContentRecord {
	/** Same as FileRecord.id — used as the primary key. */
	fileId: string;
	/** BPMN XML, DMN XML, or Form JSON string. */
	content: string;
	/** Monotonically increasing; incremented on every save. */
	version: number;
}

/** Per-project most-recently-used file order for Ctrl+Tab switching. */
export interface ProjectMruRecord {
	/** Primary key — matches ProjectRecord.id. */
	projectId: string;
	/** File IDs ordered most-recently-used first (index 0 = most recent). */
	fileIds: string[];
}
