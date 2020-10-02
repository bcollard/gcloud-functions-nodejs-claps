ID_TOKEN=$(shell gcloud auth print-identity-token)
FUNCTION=claps
GCP_REGION=europe-west1
export PROJECT_ID=personal-218506
export FIRESTORE_ENV=local
export SUPER_USER_MAIL_ADDRESS=baptiste.collard@gmail.com


.PHONY: deploy call-local-get-claps dev call-get-claps notes local-firestore
.DEFAULT_GOAL := help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'


# LOCAL
dev: ## run the Google Cloud Function NodeJS Framework locally with the parameterized function
	export FIRESTORE_EMULATOR_HOST=localhost:8081
	@npx @google-cloud/functions-framework --target=${FUNCTION}

call-local-get-claps: ## call the function locally
	@curl -X GET http://localhost:8080/ -H "Referer: http://localhost:1313/posts/openldap-helm-chart/" -H "Origin: http://localhost:1313"
	#curl -X GET http://localhost:8080/ -H "Referer: http://localhosdt:1313/posts/openldap-helm-chart/"
	#curl -X GET http://localhost:8080/ -H "Referer: https://baptistout.net/posts/o?penldap-helm-chart/"

local-firestore: ## run a local firestore
	firebase emulators:start --only firestore --import firestore-dump-personal-218506/2020-04-21T08:42:16_78280

start-local-redis: ## run a local redis store (docker)
	docker run -d -p 6379:6379 --name redis-rate-limiter redis

stop-local-redis: ## stop the local redis (docker)
	docker stop redis-rate-limiter

rm-local-redis: ## rm the local redis (docker)
	docker rm redis-rate-limiter



# REMOTE
deploy: ## deploy the function to GCP
	@gcloud functions deploy ${FUNCTION} \
		--entry-point ${FUNCTION} \
		--region ${GCP_REGION} \
		--runtime nodejs10 \
		--trigger-http \
		--timeout 10 \
		--memory 256MB \
		--allow-unauthenticated \
		--set-env-vars PROJECT_ID=${PROJECT_ID} \
		--set-env-vars REDIS_HOST=10.29.74.131 \
		--vpc-connector projects/${PROJECT_ID}/locations/europe-west1/connectors/bco-serverless-connector \
		--set-env-vars OAUTH_REDIRECT_URI=https://${GCP_REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION}/secure/oauthcallback \
		--set-env-vars SUPER_USER_MAIL_ADDRESS=${SUPER_USER_MAIL_ADDRESS}

call-get-claps: ## call the function deployed on GCP
	@curl -X GET https://${GCP_REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION} -H "Referer: https://baptistout.net/posts/openldap-helm-chart/" -H "Origin: https://baptistout.net"



# NOTES
define HIST
List available actions with:
> make help

There are two groups of actions: LOCAL and REMOTE, see the Makefile comments.
endef
export HIST

notes: ## print various information
	@H=$$(echo "$$HIST" | sed -E 's/^> (.*)$$/\\033[90m\1\\033[0m/g') ;\
	echo "$$H" ;\

