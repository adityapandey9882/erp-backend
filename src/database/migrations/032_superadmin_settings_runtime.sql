INSERT INTO superadmin_settings (key, value, updated_at)
VALUES (
  'operations',
  '{"maintenanceMode":false}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

UPDATE superadmin_settings
SET
  value = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(value, '{}'::jsonb),
        '{platformName}',
        COALESCE(value->'platformName', '"Company Management ERP"'::jsonb),
        true
      ),
      '{platformDomain}',
      COALESCE(value->'platformDomain', '"http://localhost:3000"'::jsonb),
      true
    ),
    '{supportEmail}',
    COALESCE(value->'supportEmail', '"contact@companyerp.local"'::jsonb),
    true
  )
WHERE key = 'general';

UPDATE superadmin_settings
SET
  value = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(value, '{}'::jsonb),
          '{enforceGlobalMfa}',
          COALESCE(value->'enforceGlobalMfa', 'false'::jsonb),
          true
        ),
        '{googleSsoEnabled}',
        COALESCE(value->'googleSsoEnabled', 'false'::jsonb),
        true
      ),
      '{samlSsoEnabled}',
      COALESCE(value->'samlSsoEnabled', 'false'::jsonb),
      true
    ),
    '{requireSpecialCharacter}',
    COALESCE(value->'requireSpecialCharacter', 'false'::jsonb),
    true
  )
WHERE key = 'security';
