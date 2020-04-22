ID_TOKEN=$(shell gcloud auth print-identity-token)
FUNCTION=claps
GCP_REGION=europe-west1
GCP_PROJECT=personal-218506
export FIRESTORE_ENV=local
#export FIRESTORE_ENV=local

.PHONY: deploy call-local-get-claps dev call-get-claps notes local-firestore
.DEFAULT_GOAL := help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'


# LOCAL
dev: ## run the Google Cloud Function NodeJS Framework locally with the parameterized function
	export FIRESTORE_EMULATOR_HOST=localhost:8081
	@npx @google-cloud/functions-framework --target=${FUNCTION}

call-local-get-claps: ## call the function locally
	@curl -X GET http://localhost:8080/ -H "Referer: http://localhost:1313/posts/openldap-helm-chart/"

local-firestore: ## run a local firestore
	firebase emulators:start --only firestore --import firestore-dump-personal-218506/2020-04-21T08:42:16_78280


# REMOTE
deploy: ## deploy the function to GCP
	@gcloud functions deploy ${FUNCTION} --entry-point ${FUNCTION} --region ${GCP_REGION} --runtime nodejs10 --trigger-http --timeout 10 --memory 128MB

call-get-claps: ## call the function deployed on GCP
	@curl -X GET https://${GCP_REGION}-${GCP_PROJECT}.cloudfunctions.net/${FUNCTION} -H "Authorization: bearer ${ID_TOKEN}" -H "Referer: http://localhost:1313/posts/openldap-helm-chart/"


# NOTES
define HIST
List available actions with:
> make help

There are two groups of actions: LOCAL and REMOTE, see the Makefile comments.
endef
export HIST

notes: ## print notes I took during the project setup
	@H=$$(echo "$$HIST" | sed -E 's/^> (.*)$$/\\033[90m\1\\033[0m/g') ;\
	echo "$$H" ;\
	
