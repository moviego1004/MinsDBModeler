import { DEFAULT_MODEL_YAML } from '../defaultModel.js';

export interface ProjectFile {
  name: string;
  content: string;
  layout?: Record<string, { x: number; y: number }>;
}

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  activeFileName?: string;
}

const STORAGE_KEY = 'mins_db_modeler_projects';
const ACTIVE_PROJECT_KEY = 'mins_db_modeler_active_project_id';

const SAMPLE_SQL_CONTENT = `-- Sample Oracle SQL DDL
-- This file belongs to the project and can be edited.

CREATE TABLE USERS (
  USER_ID VARCHAR2(50) PRIMARY KEY,
  USER_TYPE VARCHAR2(20) NOT NULL,
  LOGIN_ID VARCHAR2(100) NOT NULL,
  PASSWORD_HASH VARCHAR2(256),
  EMAIL_ADDRESS VARCHAR2(100),
  PHONE_NUMBER VARCHAR2(20),
  STATUS_CODE VARCHAR2(20) NOT NULL,
  LAST_LOGIN_DATE TIMESTAMP,
  CREATE_DATE TIMESTAMP NOT NULL,
  UPDATE_DATE TIMESTAMP NOT NULL
);

CREATE TABLE MEMBER (
  USER_ID VARCHAR2(50) PRIMARY KEY,
  MEMBER_TYPE VARCHAR2(20) NOT NULL,
  JOIN_DATE TIMESTAMP NOT NULL,
  STATUS_CODE VARCHAR2(20) NOT NULL,
  AGREE_DATE TIMESTAMP,
  PRIVACY_AGREE_DATE TIMESTAMP,
  CONSTRAINT FK_MEMBER_USER FOREIGN KEY (USER_ID) REFERENCES USERS(USER_ID)
);
`;

export function getProjects(): Project[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return initializeDefaultProject();
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load projects from localStorage', e);
    return initializeDefaultProject();
  }
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects to localStorage', e);
  }
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function setActiveProjectId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

export function initializeDefaultProject(): Project[] {
  const defaultProject: Project = {
    id: 'proj_default',
    name: 'QVI 이용자 관리 모델',
    activeFileName: 'qvi-user-logical.yaml',
    files: [
      {
        name: 'qvi-user-logical.yaml',
        content: DEFAULT_MODEL_YAML,
      },
      {
        name: 'vlei_qvi_db_oracle.sql',
        content: SAMPLE_SQL_CONTENT,
      }
    ]
  };
  const projects = [defaultProject];
  saveProjects(projects);
  setActiveProjectId(defaultProject.id);
  return projects;
}

export function createProject(name: string): Project {
  const newProj: Project = {
    id: `proj_${Date.now()}`,
    name: name,
    activeFileName: 'new-model.yaml',
    files: [
      {
        name: 'new-model.yaml',
        content: `subject_area: ${name}
notation: Barker logical model
version: 0.1
status: draft
entities: []
relationships: []
`
      }
    ]
  };
  const projects = getProjects();
  projects.push(newProj);
  saveProjects(projects);
  return newProj;
}

export function renameProject(id: string, newName: string): Project[] {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === id);
  if (index !== -1) {
    projects[index].name = newName;
    saveProjects(projects);
  }
  return projects;
}

export function deleteProject(id: string): Project[] {
  let projects = getProjects();
  projects = projects.filter(p => p.id !== id);
  if (projects.length === 0) {
    return initializeDefaultProject();
  }
  saveProjects(projects);
  return projects;
}
