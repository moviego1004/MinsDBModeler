import {
  DEFAULT_PROJECT_CONFIG_YAML,
  DEFAULT_CONCEPTUAL_YAML,
  DEFAULT_LOGICAL_YAML,
  DEFAULT_KERI_WALLET_LOGICAL_YAML,
  DEFAULT_APPLICATION_LIFECYCLE_LOGICAL_YAML,
  DEFAULT_BILLING_PAYMENT_POINT_LOGICAL_YAML,
  DEFAULT_INTEGRATION_AUDIT_NOTIFICATION_LOGICAL_YAML,
  DEFAULT_PORTAL_CONTENT_LOGICAL_YAML,
  DEFAULT_IDENTIFIER_LOGICAL_YAML,
  DEFAULT_DICTIONARY_YAML,
  DEFAULT_DOMAINS_YAML,
  DEFAULT_OVERRIDES_YAML,
} from '../defaultModel.js';
import { importLegacyProject } from '@barker-modeler/model-core';

/** The bundled QVI sample, converted to a repository project. */
export function buildSampleProject() {
  return importLegacyProject({
    name: 'QVI 예제 프로젝트',
    files: [
      { name: 'dbproject.yaml', content: DEFAULT_PROJECT_CONFIG_YAML },
      { name: 'conceptual/model.yaml', content: DEFAULT_CONCEPTUAL_YAML },
      { name: 'logical/user.yaml', content: DEFAULT_LOGICAL_YAML },
      { name: 'logical/keri-wallet.yaml', content: DEFAULT_KERI_WALLET_LOGICAL_YAML },
      { name: 'logical/application-lifecycle.yaml', content: DEFAULT_APPLICATION_LIFECYCLE_LOGICAL_YAML },
      { name: 'logical/billing-payment-point.yaml', content: DEFAULT_BILLING_PAYMENT_POINT_LOGICAL_YAML },
      { name: 'logical/integration-audit-notification.yaml', content: DEFAULT_INTEGRATION_AUDIT_NOTIFICATION_LOGICAL_YAML },
      { name: 'logical/portal-content.yaml', content: DEFAULT_PORTAL_CONTENT_LOGICAL_YAML },
      { name: 'logical/identifier.yaml', content: DEFAULT_IDENTIFIER_LOGICAL_YAML },
      { name: 'physical/overrides.yaml', content: DEFAULT_OVERRIDES_YAML },
      { name: 'standardization/dictionary.yaml', content: DEFAULT_DICTIONARY_YAML },
      { name: 'standardization/domains.yaml', content: DEFAULT_DOMAINS_YAML },
    ],
  });
}
