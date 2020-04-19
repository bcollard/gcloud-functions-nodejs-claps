ID_TOKEN=$(shell gcloud auth print-identity-token)
FUNCTION=claps

.PHONY: deploy call history run-local call-local


# NOTES
define HIST
Google Cloud Functions + Firestore article: https://cloud.google.com/community/tutorials/cloud-functions-firestore
Claps server API: 
npm init
npm install @google-cloud/functions-framework
npm install --save --save-exact @google-cloud/firestore
endef
export HIST

notes:
	@echo "$$HIST"


# LOCAL
run-local:
	npx @google-cloud/functions-framework --target=${FUNCTION}

call-local-get-claps:
	curl -X GET http://localhost:8080/


# REMOTE
deploy:
	gcloud functions deploy ${FUNCTION} --entry-point ${FUNCTION} --region europe-west1 --runtime nodejs10 --trigger-http --timeout 6

call-get-claps:
	curl -X GET https://europe-west1-personal-218506.cloudfunctions.net/helloGET -H "Authorization: bearer ${ID_TOKEN}"
