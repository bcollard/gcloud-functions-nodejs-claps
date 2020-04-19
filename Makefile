ID_TOKEN=$(shell gcloud auth print-identity-token)
FUNCTION=claps
GCP_REGION=europe-west1
GCP_PROJECT=personal-218506

.PHONY: deploy call history run-local call-local
.DEFAULT_GOAL := help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'


# LOCAL
run-local: ## run the Google Cloud Function NodeJS Framework locally with the parameterized function
	npx @google-cloud/functions-framework --target=${FUNCTION}

call-local-get-claps: ## call the function locally
	@curl -X GET http://localhost:8080/


# REMOTE
deploy: ## deploy the function to GCP
	gcloud functions deploy ${FUNCTION} --entry-point ${FUNCTION} --region ${GCP_REGION} --runtime nodejs10 --trigger-http --timeout 6 --memory 128MB

call-get-claps: ## call the function deployed on GCP
	@curl -X GET https://${GCP_REGION}-${GCP_PROJECT}.cloudfunctions.net/${FUNCTION} -H "Authorization: bearer ${ID_TOKEN}"


# NOTES
define HIST
gcloud auth login
Google Cloud Functions + Firestore article: https://cloud.google.com/community/tutorials/cloud-functions-firestore
Claps server API: 
npm init
npm install @google-cloud/functions-framework
npm install @google-cloud/firestore
endef
export HIST

notes: ## print notes I took during the project setup
	@echo "$$HIST"
