ID_TOKEN=$(shell gcloud auth print-identity-token)

.PHONY: deploy call history

# notes
define HIST
npm init
npm install @google-cloud/functions-framework
endef
export HIST

history:
	@echo "$$HIST"
	
deploy:
	gcloud functions deploy helloGET --entry-point helloWorld --region europe-west1 --runtime nodejs10 --trigger-http --timeout 6

call:
	curl https://europe-west1-personal-218506.cloudfunctions.net/helloGET -H "Authorization: bearer ${ID_TOKEN}"
