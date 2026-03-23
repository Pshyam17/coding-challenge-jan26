DEFINE TABLE apple SCHEMAFULL;
DEFINE FIELD attributes ON apple TYPE object;
DEFINE FIELD preferences ON apple TYPE object;
DEFINE FIELD request_id ON apple TYPE string;
DEFINE FIELD created_at ON apple TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_apple_request_id ON apple FIELDS request_id UNIQUE;
DEFINE INDEX idx_apple_created_at ON apple FIELDS created_at;

DEFINE TABLE orange SCHEMAFULL;
DEFINE FIELD attributes ON orange TYPE object;
DEFINE FIELD preferences ON orange TYPE object;
DEFINE FIELD request_id ON orange TYPE string;
DEFINE FIELD created_at ON orange TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_orange_request_id ON orange FIELDS request_id UNIQUE;
DEFINE INDEX idx_orange_created_at ON orange FIELDS created_at;

DEFINE TABLE matched_to SCHEMAFULL TYPE RELATION IN apple OUT orange;
DEFINE FIELD score ON matched_to TYPE float;
DEFINE FIELD apple_score ON matched_to TYPE float;
DEFINE FIELD orange_score ON matched_to TYPE float;
DEFINE FIELD narrative ON matched_to TYPE option<string>;
DEFINE FIELD created_at ON matched_to TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_match_apple ON matched_to FIELDS in;
DEFINE INDEX idx_match_orange ON matched_to FIELDS out;
DEFINE INDEX idx_match_score ON matched_to FIELDS score;
DEFINE INDEX idx_match_created_at ON matched_to FIELDS created_at;
