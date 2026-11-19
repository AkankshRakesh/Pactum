# Pactum

**Draft it. Agree on it. Keep it forever.**

Pactum is a contract collaboration and signing application. A contract creator
can start from a template or a blank document, invite another party, collect
clause-level comments, and complete signing through an authenticated account or
a secure guest invitation link. The application preserves the contract,
invitation, comments, and signing state in a Django-backed database.

The repository is a two-application system:

- **Django** provides the JSON API, authentication, sessions, validation,
  database models, invitation workflows, email delivery, PDF generation, and
  the Django Admin site.
- **Next.js** provides the browser application. Its App Router pages and React
  components call the Django API and include a server-side proxy route for
  same-origin browser requests.

> **Repository status:** the Kubernetes and AWS deployment definitions are
> present, but this checkout does not currently contain `backend/Dockerfile`,
> `frontend/Dockerfile`, a frontend Kubernetes workload, or a root
> `bootstrap.sh`. The Jenkins pipeline expects `backend/Dockerfile`, so the
> container deployment cannot complete until that expected artifact is added or
> the pipeline is changed.

---

## Contents

- [Product workflow](#product-workflow)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Backend](#backend)
- [Frontend](#frontend)
- [Data model](#data-model)
- [API surface](#api-surface)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Security model](#security-model)
- [DevOps and deployment architecture](#devops-and-deployment-architecture)
- [Operations and troubleshooting](#operations-and-troubleshooting)
- [Validation](#validation)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)

---

## Product workflow

1. A user signs up, signs in, or uses Google OAuth.
2. The user creates a draft contract in the Next.js editor.
3. The editor saves title, subtitle, and HTML contract content through Django.
4. The creator sends an invitation to the counterparty.
5. Django generates a random invitation token, stores only its SHA-256 hash,
   and emails the raw token in a review URL.
6. The invitee opens the review page, comments against individual clauses, and
   either claims the invitation with a matching account or signs as a guest.
7. Signing changes the invitation to `accepted` and the contract to
   `executed`. Executed contracts cannot be edited.
8. Django generates an execution PDF and sends notification email after the
   signing transaction commits.

---

## Architecture

```text
                         Browser
                            |
                 Next.js application
           pages, React components, editor
                            |
        /backend/[...path] Next.js proxy route
                            |
                    Django JSON API
          views, forms, auth, sessions, CSRF
                            |
                 Django ORM and migrations
                            |
             SQLite (local) / PostgreSQL (prod)

 Django also integrates with:
   - Google OAuth
   - SMTP email
   - xhtml2pdf for executed-contract PDFs
   - Django Admin
```

In the deployed design, the backend path is:

```text
Internet
  -> AWS Application Load Balancer
  -> NodePort 30080 on two EC2 instances
  -> k3s Kubernetes Service
  -> two Django pods
  -> Supabase PostgreSQL
```

The frontend is not deployed by the repository's Kubernetes manifests. The
Next.js application can be hosted separately, for example on a platform that
supports Next.js standalone deployments. Its `NEXT_PUBLIC_LB` value must point
to the Django load balancer, while browser API calls normally use
`NEXT_PUBLIC_API_URL=/backend`.

---

## Repository layout

```text
pactum/
├── README.md
├── Jenkinsfile
├── home.png
├── image.png
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── db.sqlite3                 # local development database in this checkout
│   ├── pactum/
│   │   ├── settings.py            # environment, middleware, DB, email
│   │   ├── urls.py                # admin + core URL inclusion
│   │   ├── asgi.py
│   │   └── wsgi.py
│   └── core/
│       ├── models.py              # Contract, ContractInvitation, Comment
│       ├── views.py               # API views and workflow logic
│       ├── forms.py               # JSON input validation
│       ├── urls.py                # API routes
│       ├── admin.py               # Django Admin configuration
│       ├── middleware.py          # frontend CORS handling
│       ├── emails.py              # emails and execution PDF
│       ├── migrations/
│       ├── templates/
│       └── static/
├── frontend/
│   ├── package.json
│   ├── next.config.ts.example
│   ├── .env.local.example
│   └── src/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── auth/
│       │   ├── dashboard/
│       │   ├── new/
│       │   ├── templates/
│       │   ├── contract/[id]/
│       │   ├── invite/[token]/
│       │   └── backend/[...path]/route.ts
│       ├── components/
│       └── lib/
├── infra/
│   ├── cloudformation/pactum-backend.yaml
│   ├── deploy/kubernetes/
│   │   ├── backend-deployment.yaml
│   │   ├── backend-service.yaml
│   │   └── django-migration-job.yaml
│   └── scripts/setup-monitoring.sh
└── .vscode/settings.json
```

Generated or machine-local directories such as `backend/env`,
`frontend/node_modules`, and `.next` should not be treated as source code.

---

## Backend

### Django project configuration

The Django project package is `backend/pactum`. Its settings:

- Load variables from `backend/.env`.
- Install Django Admin, authentication, sessions, messages, static files,
  and the `core` app.
- Enable security, sessions, CSRF, authentication, and clickjacking middleware.
- Use SQLite unless `DB_HOST` is set, in which case PostgreSQL is configured.
- Use a seven-day HTTP-only session cookie.
- Allow the configured local and production frontend origins.
- Use console email delivery by default and SMTP when configured.

`manage.py` sets the development server's default port to `8081`:

```powershell
python manage.py runserver
```

### Core application

`backend/core` contains the main domain implementation:

- `views.py` contains function-based JSON API views.
- `forms.py` validates parsed JSON using Django `Form` classes.
- `models.py` defines the persisted domain objects.
- `urls.py` maps API paths to views.
- `middleware.py` handles the explicit frontend CORS contract.
- `emails.py` renders email templates and creates execution PDFs.
- `admin.py` configures administrative list views, filters, searches, inlines,
  and actions.

The API uses `JsonResponse`, not Django REST Framework. State-changing browser
requests send JSON and include the `X-CSRFToken` header.

### Validation and HTML handling

The forms layer normalizes and validates:

- Signup and password confirmation.
- Username and email uniqueness.
- Email-based or username-based login.
- Contract title, subtitle, and HTML size limits.
- Comment body, clause ID, quoted text, and clause position.
- Invitation email and signing mode.

Contract HTML is sanitized by removing script/style blocks, inline event
attributes, and `javascript:` URLs. Ordered-list clauses receive stable
`data-clause-id` values so comments continue to refer to the same clause when
the document is edited.

### Templates, email, and PDF

Django templates are used for generated output rather than the main browser UI:

- `core/templates/emails/` contains invitation and executed-contract emails.
- `core/templates/pdf/contract_execution.html` is converted to PDF with
  `xhtml2pdf`.
- `core/templates/core/` contains the older Django-rendered home-page
  templates.

After signing, the PDF includes signer details, signing method, timestamp,
contract ID, and a SHA-256 fingerprint of the original contract HTML.

---

## Frontend

The frontend is a Next.js 16 App Router application using React 19 and
TypeScript.

Important pages:

- `/` — landing page.
- `/auth` — login and registration.
- `/dashboard` — owned and invited contracts.
- `/new` — contract creation.
- `/templates` — contract template gallery.
- `/contract/[id]` — editing and creator actions.
- `/contract/[id]?review=1` — authenticated review.
- `/invite/[token]` — public invitation review and guest signing.

Important components:

- `ContractEditor` — editing, saving, inviting, revoking, and comment status.
- `ContractReview` — review and authenticated invitee actions.
- `ContractLoader` — loading state.
- `CommentStatus` — comment workflow display.
- `ConfirmDialog` — destructive-action confirmation.

### Same-origin proxy

`frontend/src/app/backend/[...path]/route.ts` forwards browser requests to
the configured Django origin. It:

- Adds Django's trailing slash to upstream paths.
- Forwards selected request headers and `csrftoken`/`sessionid` cookies.
- Supports GET, POST, PUT, PATCH, DELETE, OPTIONS, and HEAD.
- Preserves OAuth redirects.
- Passes upstream cookies back to the browser.

This proxy helps keep browser requests same-origin while Django remains a
separate service.

---

## Data model

### `Contract`

Represents a contract owned by a Django user.

- UUID primary key.
- Creator foreign key.
- Title, subtitle, and HTML body.
- Status: `draft`, `sent`, or `executed`.
- Created, updated, and sent timestamps.
- Optional invited email.

### `ContractInvitation`

Represents the one-to-one invitation associated with a contract.

- Invitee email.
- SHA-256 token hash.
- Expiration and revocation timestamps.
- Claiming user and signing user.
- Signer name and signature mode.
- Status: `pending`, `sent`, `accepted`, or `revoked`.

### `ContractComment`

Represents feedback attached to a contract and optionally to an invitation or
authenticated author.

- Body and quoted text.
- Stable clause ID and legacy clause index.
- Author identity.
- Status: `pending`, `resolved`, or `rejected`.
- Created and status-change timestamps.

### Migrations

The `core/migrations` history creates the models, adds signing and collaboration
fields, backfills clause IDs, and adds comment status fields. Production
deployments must run migrations against the shared database before the new
application pods are considered ready.

---

## API surface

All paths below are relative to the Django origin or the Next.js `/backend`
proxy.

### Authentication

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/csrf/` | Issue a CSRF cookie and token |
| POST | `/api/auth/signup/` | Create and log in a user |
| POST | `/api/auth/login/` | Authenticate by username or email |
| POST | `/api/auth/logout/` | End the session |
| GET | `/api/auth/me/` | Return the current user |
| GET | `/api/auth/google/start/` | Start Google OAuth |
| GET | `/api/auth/google/callback/` | Complete Google OAuth |

### Contracts and invitations

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/contracts/` | List contracts owned by the user |
| GET | `/api/contracts/invited/` | List contracts claimed by the user |
| GET | `/api/contracts/<uuid>/` | Retrieve an owned contract |
| PUT/PATCH | `/api/contracts/<uuid>/` | Update an unexecuted contract |
| DELETE | `/api/contracts/<uuid>/` | Delete an owned contract |
| POST | `/api/contracts/save/` | Create or save a draft |
| POST | `/api/contracts/send/` | Save and send an invitation |
| POST | `/api/contracts/invite/` | Invite or re-invite a party |
| POST | `/api/contracts/<uuid>/invitation/revoke/` | Revoke an invitation |
| GET | `/api/contracts/<uuid>/review/` | Load a reviewable contract |
| GET | `/api/invitations/<token>/` | Load a public invitation |
| POST | `/api/invitations/<token>/claim/` | Claim with a matching account |
| POST | `/api/invitations/<token>/sign/` | Sign as account user or guest |
| POST | `/api/contracts/<uuid>/sign/` | Sign as authenticated invitee |

### Comments

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/contracts/<uuid>/comments/` | Read or add authenticated comments |
| GET/POST | `/api/invitations/<token>/comments/` | Read or add guest comments |
| POST | `/api/contracts/<uuid>/comments/<id>/status/` | Change creator-managed status |
| DELETE | `/api/contracts/<uuid>/comments/<id>/` | Delete the authenticated author's comment |

`/health/` is a lightweight `GET` endpoint returning `{"status": "ok"}`. The
AWS load balancer uses it as its target health check.

---

## Local development

### Prerequisites

- Python 3.10 or newer.
- Node.js compatible with the installed Next.js version.
- npm.
- PostgreSQL only if you want to test the production database path.
- Docker, kubectl, and AWS CLI are optional and only needed for deployment.

### Backend on Windows

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py check
python manage.py runserver
```

The backend runs at `http://127.0.0.1:8081` by default.

If PowerShell prevents activation, use the interpreter directly:

```powershell
.\backend\.venv\Scripts\python.exe .\backend\manage.py check
```

### Backend on macOS/Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py check
python manage.py runserver
```

### Frontend

In a second terminal:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
Copy-Item next.config.ts.example next.config.ts
npm ci
npm run dev
```

On macOS/Linux, use `cp` instead of `Copy-Item`.

The frontend runs at `http://localhost:3000`. For local development,
`.env.local.example` uses:

```text
NEXT_PUBLIC_API_URL=/backend
NEXT_PUBLIC_LB=http://localhost:8081
```

### Admin user

```powershell
cd backend
python manage.py createsuperuser
```

Open `http://127.0.0.1:8081/admin/` while the Django server is running.

### Useful Django commands

```powershell
python manage.py showmigrations
python manage.py makemigrations
python manage.py migrate
python manage.py shell
python manage.py collectstatic
```

Do not run `makemigrations` in production as an ad-hoc deployment step. Review
the generated migration, commit it, and apply it through the migration job.

---

## Configuration

### Backend variables

Copy `backend/.env.example` to `backend/.env` and set values appropriate for
the environment.

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | Session signing and cryptographic Django secret |
| `DJANGO_DEBUG` | Enables development debug behavior |
| `ALLOWED_HOSTS` | Comma-separated accepted hostnames |
| `FRONTEND_URL` | Frontend origin used in redirects and email links |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Registered OAuth callback URL |
| `DB_HOST` | Enables PostgreSQL mode when present |
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_PORT` | PostgreSQL port |
| `EMAIL_BACKEND` | Django email backend |
| `EMAIL_HOST` | SMTP host |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_HOST_USER` | SMTP account |
| `EMAIL_HOST_PASSWORD` | SMTP password |
| `DEFAULT_FROM_EMAIL` | Sender address |

When `DB_HOST` is absent, Django uses `backend/db.sqlite3`. In production,
configure all PostgreSQL variables and do not use a local SQLite file shared
between replicas.

### Frontend variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Browser-visible API base, normally `/backend` |
| `NEXT_PUBLIC_LB` | Origin used by the Next.js backend proxy |

Because `NEXT_PUBLIC_*` values are exposed to browser code, never put secrets
in them.

---

## Security model

- Django sessions use HTTP-only cookies.
- Production cookies are marked secure when `DJANGO_DEBUG=False`.
- CSRF protection is enabled for normal state-changing endpoints.
- The frontend obtains a CSRF token from `/api/auth/csrf/` and sends it as
  `X-CSRFToken`.
- Contract endpoints require an authenticated Django session.
- Ownership and invitee access are checked in the views.
- Invitation tokens are generated with `secrets.token_urlsafe()` and stored as
  hashes, not plaintext.
- Invitation links expire after seven days and can be revoked.
- User passwords are created through Django's password hashing system.
- Google OAuth validates state, verified email, and Google subject identity.
- Contract body HTML is normalized before storage.

Production requirements:

1. Set a long, random `DJANGO_SECRET_KEY`.
2. Set `DJANGO_DEBUG=False`.
3. Use HTTPS at the load balancer and frontend.
4. Configure `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and CORS origins
   narrowly.
5. Store database, SMTP, OAuth, and admin credentials in a secret manager or
   Kubernetes Secret, never in Git.
6. Rotate any credentials that have appeared in a committed `.env` file.

---

## DevOps and deployment architecture

A detailed devops report pdf is also attached in the repo.

### Infrastructure provisioned by CloudFormation

`infra/cloudformation/pactum-backend.yaml` provisions:

- A VPC with two public subnets in separate Availability Zones.
- An internet gateway and public routing.
- An internet-facing AWS Application Load Balancer.
- An ALB target group pointing to NodePort `30080`.
- Two backend EC2 instances.
- A monitoring EC2 instance.
- IAM instance roles with Systems Manager and narrowly scoped Secrets Manager
  access.
- Encrypted 20 GB gp3 root volumes.
- IMDSv2-required instance metadata.
- A generated Grafana administrator secret.

The two backend instances bootstrap k3s. The monitoring instance installs
Docker and AWS CLI prerequisites. CloudFormation outputs include backend
instance IDs, private IPs, the ALB DNS name, the monitoring instance ID, and
the Grafana secret ARN.

The CloudFormation template currently exposes an HTTP ALB listener. HTTPS and
an ACM certificate must be added before production traffic carries credentials
or contract data.

### Kubernetes workload

The manifests in `infra/deploy/kubernetes/` describe the backend workload:

1. `backend-service.yaml` exposes Django through a NodePort:
   `30080 -> 8000`.
2. `backend-deployment.yaml` runs two Django replicas with a rolling update
   strategy, resource requests/limits, and TCP readiness/liveness probes.
3. `django-migration-job.yaml` runs `python manage.py migrate` against the
   shared PostgreSQL database before the application rollout.

The manifests use placeholders:

- `BACKEND_IMAGE_PLACEHOLDER`
- `ALLOWED_HOSTS_PLACEHOLDER`

The Jenkins pipeline replaces these values before applying the manifests.

There is currently no frontend Kubernetes Deployment or Service in this
repository. The backend manifests therefore deploy only Django. The Next.js
frontend must be hosted separately or a frontend workload must be added.

### Jenkins pipeline

`Jenkinsfile` is the release automation entry point. Its stages are:

1. **Checkout and validate**
   - Checks out the repository.
   - Verifies the expected backend Dockerfile and infrastructure files.
2. **Build and push image**
   - Logs in to Docker Hub.
   - Builds `backend`.
   - Pushes `${DOCKERHUB_USR}/pactum-backend:latest`.
3. **Provision infrastructure**
   - Runs CloudFormation deployment.
   - Reads stack outputs for instance IDs, ALB DNS, private IPs, and monitoring
     identifiers.
4. **Wait for nodes**
   - Uses AWS Systems Manager to wait for cloud-init, k3s, and node readiness.
5. **Install Node Exporter**
   - Installs node_exporter on both backend instances for Prometheus metrics.
6. **Configure monitoring**
   - Transfers `setup-monitoring.sh` to the monitoring instance through SSM.
   - Starts Prometheus and Grafana containers.
7. **Deploy backend**
   - Creates the `pactum` namespace.
   - Creates application and SMTP Kubernetes Secrets.
   - Applies the Service.
   - Deletes/recreates the migration Job and waits for completion.
   - Applies the Deployment.
   - Injects SMTP environment variables.
   - Restarts the Deployment and waits for rollout success.

The pipeline uses Jenkins credentials for AWS, Docker Hub, the database
password, the Django secret key, and SMTP credentials. Those values must be
configured in Jenkins before the pipeline runs.

The deployment uses a shared Supabase PostgreSQL database. The pipeline
intentionally runs migrations once, on the first backend instance, rather than
running them independently on every replica.

### Monitoring

`infra/scripts/setup-monitoring.sh` installs:

- Prometheus `v3.5.0`
- Grafana `12.2.0`
- Persistent Docker volumes for both services
- A provisioned Prometheus datasource
- A provisioned Pactum node/pod overview dashboard

Prometheus scrapes:

- Prometheus itself.
- node_exporter on each backend EC2 instance at port `9100`.
- k3s kubelet/cAdvisor metrics through port `10255`.

The script retrieves the Grafana password from AWS Secrets Manager without
printing it to the log, writes it as a protected file, and supplies it to the
Grafana container using `GF_SECURITY_ADMIN_PASSWORD__FILE`.

The monitoring security group is deliberately separate from the backend
security group. Review network exposure before enabling external access to
Grafana.

### Deployment prerequisites and gap

The current Jenkins pipeline validates `backend/Dockerfile` and later runs
`docker build ... backend`, but that file is absent from this checkout.
Before using the pipeline:

1. Add a production backend Dockerfile that starts Django with a production
   WSGI/ASGI server and listens on port `8000`, or update the pipeline to use
   an existing image build.
2. Decide how the Next.js application will be deployed.
3. Add HTTPS termination and update frontend, OAuth, CORS, and CSRF origins.
4. Replace the `latest` image tag with immutable commit or release tags.
5. Add a database backup and restore procedure.

---

## Operations and troubleshooting

### Check the Django application

```powershell
cd backend
python manage.py check
python manage.py showmigrations
```

### Check the health endpoint

```powershell
curl http://127.0.0.1:8081/health/
```

Expected response:

```json
{"status": "ok"}
```

### Inspect Kubernetes resources

```bash
kubectl -n pactum get pods -o wide
kubectl -n pactum get deployment pactum-backend
kubectl -n pactum get job pactum-migrate
kubectl -n pactum logs deployment/pactum-backend --all-containers
kubectl -n pactum logs job/pactum-migrate
```

On the EC2 k3s hosts, the equivalent command is:

```bash
/usr/local/bin/k3s kubectl -n pactum get pods -o wide
```

### Common failures

- **CSRF failure:** verify the frontend origin is in Django's trusted origins
  and that the browser sends both the session/CSRF cookies and
  `X-CSRFToken`.
- **401 responses:** verify `credentials: "include"` and confirm the proxy
  forwards `sessionid`.
- **Invitation unavailable:** check expiration, revocation, and that only the
  hash—not a modified token—is being used.
- **Email failure:** inspect SMTP variables and Django logs. Invitation email
  failures occur inside a transaction and can roll back the invitation.
- **Migration job failure:** inspect the Job logs and verify database host,
  user, password, network access, and migration ordering.
- **Unhealthy ALB targets:** verify the Django process listens on port `8000`,
  `/health/` returns HTTP 200, and the Service targets the correct port.
- **Jenkins checkout failure:** the pipeline currently requires
  `backend/Dockerfile`, which is not present in this checkout.

---

## Validation

Backend system checks:

```powershell
cd backend
python manage.py check
```

Frontend lint:

```powershell
cd frontend
npm run lint
```

Frontend production build:

```powershell
cd frontend
npm run build
```

The repository currently does not contain a Django `tests.py` or a dedicated
backend test suite. Add focused tests for authentication, CSRF, invitation
expiration, ownership checks, comment permissions, migrations, and signing
before treating a production deployment as fully verified.

---

## Known limitations

- No backend Dockerfile is present, although Jenkins and the deployment process
  require one.
- No frontend Dockerfile or Kubernetes deployment is present.
- The CloudFormation load balancer is HTTP-only.
- The default development secret-key fallback must not be used in production.
- The local `.env` file must never be committed or copied into an image.
- No automated Django test suite is currently included.
- SQLite is suitable for local development only, not for multiple production
  replicas.
- The application has application-level authorization checks, but no separate
  custom Django permission classes or role model.

---

## Contributing

1. Create a feature branch.
2. Keep changes scoped to the feature or fix.
3. Add or update focused tests when behavior changes.
4. Run Django checks and frontend lint/build locally.
5. Review migration files before applying them.
6. Never commit secrets, local databases, virtual environments, `node_modules`,
   or build output.
7. Open a pull request describing configuration, migration, and deployment
   implications.
