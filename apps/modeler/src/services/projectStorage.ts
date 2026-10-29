import { 
  DEFAULT_PROJECT_CONFIG_YAML,
  DEFAULT_CONCEPTUAL_YAML,
  DEFAULT_LOGICAL_YAML,
  DEFAULT_USER_ACCOUNT_LOGICAL_YAML,
  DEFAULT_KERI_WALLET_LOGICAL_YAML,
  DEFAULT_APPLICATION_LIFECYCLE_LOGICAL_YAML,
  DEFAULT_BILLING_PAYMENT_POINT_LOGICAL_YAML,
  DEFAULT_INTEGRATION_AUDIT_NOTIFICATION_LOGICAL_YAML,
  DEFAULT_PORTAL_CONTENT_LOGICAL_YAML,
  DEFAULT_IDENTIFIER_LOGICAL_YAML,
  DEFAULT_DICTIONARY_YAML,
  DEFAULT_DOMAINS_YAML,
  DEFAULT_OVERRIDES_YAML
} from '../defaultModel.js';

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
    const projects: Project[] = JSON.parse(data);

    // Self-healing: Clean up any corrupted or NaN layout coordinates to prevent canvas crashes
    projects.forEach(proj => {
      if (proj.files) {
        proj.files.forEach(f => {
          if (f.layout) {
            const layout = f.layout;
            const cleanedLayout: Record<string, { x: number; y: number; width?: number; height?: number }> = {};
            Object.keys(layout).forEach(id => {
              const item = layout[id] as any;
              if (item && typeof item.x === 'number' && !isNaN(item.x) && typeof item.y === 'number' && !isNaN(item.y)) {
                cleanedLayout[id] = item;
              }
            });
            f.layout = cleanedLayout;
          }
        });
      }
    });
    
    // Migration: If the default project exists but does not have the new detailed logical model files,
    // force re-initialize the default project to load all 8 logical files.
    const defaultProjIndex = projects.findIndex(p => p.id === 'proj_default');
    if (defaultProjIndex !== -1) {
      const defaultProj = projects[defaultProjIndex];
      const hasLifecycle = defaultProj.files.some(f => f.name === 'logical/application-lifecycle.yaml');
      const hasCorruption = defaultProj.files.some(f => f.content.includes('name: - { name') || f.content.includes('identifier: - { name'));
      const hasUpdatedDict = defaultProj.files.some(f => f.name === 'standardization/dictionary.yaml' && f.content.includes('생명주기'));
      if (!hasLifecycle || hasCorruption || !hasUpdatedDict) {
        const upgradedDefault = initializeDefaultProject()[0];
        projects[defaultProjIndex] = upgradedDefault;
        saveProjects(projects);
      }
    }
    
    return projects;
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
    activeFileName: 'conceptual/model.yaml',
    files: [
      {
        name: 'dbproject.yaml',
        content: DEFAULT_PROJECT_CONFIG_YAML,
      },
      {
        name: 'conceptual/model.yaml',
        content: DEFAULT_CONCEPTUAL_YAML,
      },
      {
        name: 'logical/user.yaml',
        content: DEFAULT_LOGICAL_YAML,
      },
      {
        name: 'logical/user-account.yaml',
        content: DEFAULT_USER_ACCOUNT_LOGICAL_YAML,
      },
      {
        name: 'logical/keri-wallet.yaml',
        content: DEFAULT_KERI_WALLET_LOGICAL_YAML,
      },
      {
        name: 'logical/application-lifecycle.yaml',
        content: DEFAULT_APPLICATION_LIFECYCLE_LOGICAL_YAML,
      },
      {
        name: 'logical/billing-payment-point.yaml',
        content: DEFAULT_BILLING_PAYMENT_POINT_LOGICAL_YAML,
      },
      {
        name: 'logical/integration-audit-notification.yaml',
        content: DEFAULT_INTEGRATION_AUDIT_NOTIFICATION_LOGICAL_YAML,
      },
      {
        name: 'logical/portal-content.yaml',
        content: DEFAULT_PORTAL_CONTENT_LOGICAL_YAML,
      },
      {
        name: 'logical/identifier.yaml',
        content: DEFAULT_IDENTIFIER_LOGICAL_YAML,
      },
      {
        name: 'physical/overrides.yaml',
        content: DEFAULT_OVERRIDES_YAML,
      },
      {
        name: 'standardization/dictionary.yaml',
        content: DEFAULT_DICTIONARY_YAML,
      },
      {
        name: 'standardization/domains.yaml',
        content: DEFAULT_DOMAINS_YAML,
      },
      {
        name: 'output/schema.sql',
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
    activeFileName: 'conceptual/model.yaml',
    files: [
      {
        name: 'dbproject.yaml',
        content: `project_name: ${name}
version: 1.0.0
target_db: POSTGRESQL
subtype_strategy: ROLL_UP
naming_case: SNAKE_CASE
`,
      },
      {
        name: 'conceptual/model.yaml',
        content: `subject_area: ${name} 개념 모델
version: 0.1
status: draft
modeling_level: conceptual
entities: []
relationships: []
`,
      },
      {
        name: 'logical/model.yaml',
        content: `subject_area: ${name} 상세 논리 모델
notation: Barker-style nested subtype
version: 0.1
status: draft
entities: []
relationships: []
`,
      },
      {
        name: 'physical/overrides.yaml',
        content: `table_overrides: []
`,
      },
      {
        name: 'standardization/dictionary.yaml',
        content: `words: []
terms: []
`,
      },
      {
        name: 'standardization/domains.yaml',
        content: `domains: []
`,
      },
      {
        name: 'output/schema.sql',
        content: `-- SQL DDL Output will go here
`,
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
