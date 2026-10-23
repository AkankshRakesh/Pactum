# Pactum

**Draft it. Agree on it. Keep it forever.**

Pactum is a consolidated contract platform that brings everyone who is part of an agreement into one place. A contract owner can create a contract from a template (or from scratch), invite the other party, negotiate the wording clause by clause, and sign, all in a few clicks. Once the contract is signed, both parties keep access to the same final version, so neither side is left relying on a lost email attachment or a "he said, she said" dispute.

---

## Table of Contents

- [Why Pactum](#why-pactum)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Legal Notice](#legal-notice)
- [Contributing](#contributing)
- [License](#license)

---

## Why Pactum

Contracts today are scattered across email threads, PDFs, chat messages and shared drives. Versions drift, feedback gets lost, and after signing, one party often ends up holding the only "real" copy.

Pactum fixes this by giving **contract owners and counterparties a single shared workspace** where:

- Creating a contract takes a click, not a day of formatting.
- The other party is invited by a secure link, with no back-and-forth emailing of files.
- Every comment, change and approval is recorded against the specific clause it relates to.
- The signed agreement is stored once and is accessible to **both** parties permanently.

---

## Key Features

| Feature | Description |
|---|---|
| **One-click contract creation** | Start from a library of ready-made templates (see the Templates page) or draft a custom contract in the built-in editor. |
| **Rich contract editor** | A dedicated editor for writing and structuring contract clauses. |
| **Invitations for counterparties** | Invite the other party with a unique invitation link (`/invite/[token]`). Invitations track when they were sent and accepted. |
| **Clause-level collaboration** | Every clause carries a stable ID, so feedback and discussion attach to the exact clause being discussed. |
| **Comments with status** | Threaded contract comments with statuses so both sides can see what is open, addressed or resolved. |
| **Contract review** | A review screen where each party can go through the contract before agreeing to it. |
| **Digital signing** | A dedicated signing experience for finalising the agreement. |
| **Shared, permanent record** | After signing, both parties retain access to the identical final contract. |
| **Dashboard** | See all your contracts, their state and pending actions in one place. |
| **Authentication** | Sign-up and login flow so every action is tied to an identified user. |
| **Light and dark themes** | Theme provider with polished UI and animated contract loaders. |

---

## How It Works

```
 ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 │  Create  │ -> │  Invite  │ -> │ Review & │ -> │   Sign   │ -> │  Stored  │
 │ contract │    │  other   │    │ comment  │    │ together │    │ for both │
 │ (template│    │  party   │    │ per      │    │          │    │ parties  │
 │ or blank)│    │          │    │ clause   │    │          │    │          │
 └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

1. **Create**: The owner picks a template or starts blank and edits the clauses.
2. **Invite**: The owner invites the counterparty by link. The counterparty signs in (or signs up) and accepts.
3. **Review and discuss**: Both parties comment on specific clauses and resolve feedback.
4. **Sign**: Once everyone agrees, the contract is signed.
5. **Keep forever**: The finalised contract remains available to both parties from their dashboards.

---

## Tech Stack

**Backend**
- Python / [Django](https://www.djangoproject.com/)
- Django app `core` containing models (contracts, invitations, comments), views, middleware and server-rendered pages (home, signing)
- Dockerised with `backend/Dockerfile`

**Frontend**
- [Next.js](https://nextjs.org/) (App Router) with TypeScript
- CSS modules and global styles, ESLint, PostCSS
- API proxy route at `src/app/backend/[...path]/route.ts` that forwards requests to the Django backend
- Dockerised with `frontend/Dockerfile`

**Infrastructure and DevOps**
- Kubernetes manifests (Deployments, Services, HPAs, Ingress, migration Job, Namespace)
- AWS CloudFormation template for the backend
- Helm-based tooling image for AWS (`infra/cloudformation/jenkins-tools/helm-aws`)
- Monitoring stack configuration via Helm values
- Helper scripts for bootstrapping, validation, deployment and verification

---

## Project Structure

```
pactum/
├── README.md
├── bootstrap.sh                 # One-shot local/environment bootstrap
├── backend/                     # Django application
│   ├── Dockerfile
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example             # Copy to .env and fill in
│   ├── core/                    # Main app
│   │   ├── models.py            # Contracts, invitations, comments
│   │   ├── views.py / urls.py   # Endpoints and routing
│   │   ├── middleware.py
│   │   ├── migrations/          # Schema history (incl. collaboration fields,
│   │   │                        #   clause-ID backfill, comment status)
│   │   ├── static/core/         # CSS/JS for home page and signing
│   │   └── templates/core/      # base.html, home.html, animation partial
│   └── pactum/                  # Django project (settings, urls, wsgi/asgi)
├── frontend/                    # Next.js application
│   ├── Dockerfile
│   ├── next.config.ts(.example)
│   └── src/
│       ├── app/
│       │   ├── page.tsx         # Landing page
│       │   ├── auth/            # Login / sign-up
│       │   ├── dashboard/       # User's contracts
│       │   ├── new/             # Create a contract
│       │   ├── templates/       # Template gallery
│       │   ├── contract/[id]/   # View, edit, review and sign a contract
│       │   ├── invite/[token]/  # Accept an invitation
│       │   └── backend/[...path]/route.ts   # Proxy to Django API
│       ├── components/          # ContractEditor, ContractReview,
│       │                        #   CommentStatus, TemplateCard, ConfirmDialog...
│       └── lib/templates.ts     # Template definitions
├── deploy/kubernetes/           # K8s manifests + monitoring values
├── infra/                       # CloudFormation, Helm tooling, monitoring setup
└── scripts/                     # deploy.sh, validate.sh, verify.sh, install-addons.sh, helm-docker.ps1
```

---

## Getting Started

### Prerequisites

- Python 3.10+ and `pip`
- Node.js 18+ and `npm`
- (Optional) Docker for containerised runs
- (Optional) `kubectl` and Helm for Kubernetes deployment

### 1. Clone the repository

```bash
git clone https://github.com/akankshrakesh/pactum.git
cd pactum
```

### 2. Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # then edit values as needed
python manage.py migrate
python manage.py runserver         # http://localhost:8000
```

### 3. Run the frontend

```bash
cd frontend
cp next.config.ts.example next.config.ts   # if you don't already have one
npm install
npm run dev                                 # http://localhost:3000
```

The frontend talks to Django through the `/backend/...` proxy route, so make sure the backend URL configured for the frontend points at your running Django server.

### Quick start with the bootstrap script

```bash
./bootstrap.sh
```

Review the script before running it to see exactly what it sets up on your machine.

### Run with Docker

```bash
docker build -t pactum-backend  ./backend
docker build -t pactum-frontend ./frontend
```

---

## Configuration

Backend settings live in environment variables. Start from the example file:

```bash
cp backend/.env.example backend/.env
```

Typical values to set include the Django secret key, debug flag, allowed hosts and database connection. See `.env.example` for the full list.

For the frontend, `next.config.ts.example` shows how to point the app at the backend. Copy it to `next.config.ts` and adjust for your environment.

---

## Deployment

### Kubernetes

Manifests are in `deploy/kubernetes/`:

| File | Purpose |
|---|---|
| `namespace.yaml` | Dedicated namespace |
| `backend-deployment.yaml`, `backend-service.yaml`, `backend-hpa.yaml` | Django API with autoscaling |
| `frontend-deployment.yaml`, `frontend-service.yaml`, `frontend-hpa.yaml` | Next.js app with autoscaling |
| `django-migration-job.yaml` | Runs database migrations as a Job |
| `ingress.yaml` | External routing to frontend and backend |
| `monitoring-values.yaml` | Helm values for the monitoring stack |

Basic flow (see `deploy/kubernetes/README.md` for details):

```bash
kubectl apply -f deploy/kubernetes/namespace.yaml
kubectl apply -f deploy/kubernetes/django-migration-job.yaml
kubectl apply -f deploy/kubernetes/
```

### AWS

`infra/cloudformation/pactum-backend.yaml` provisions the backend infrastructure on AWS. A Helm/AWS tooling image is provided under `infra/cloudformation/jenkins-tools/helm-aws/` for CI use.

### Helper scripts

| Script | Purpose |
|---|---|
| `scripts/validate.sh` | Validate manifests and configuration |
| `scripts/deploy.sh` | Deploy the application |
| `scripts/install-addons.sh` | Install cluster add-ons |
| `scripts/verify.sh` | Verify a deployment is healthy |
| `scripts/helm-docker.ps1` | Run Helm via Docker on Windows |

---

## Monitoring

Run `infra/scripts/setup-monitoring.sh` to install the monitoring stack using `deploy/kubernetes/monitoring-values.yaml`, giving you metrics and dashboards for the backend and frontend workloads.

---

## Legal Notice

Pactum is a tool for creating, negotiating and storing agreements. Whether a given electronic contract is legally binding depends on the jurisdiction, the type of contract and applicable e-signature law (for example, the Information Technology Act, 2000 in India, the ESIGN Act and UETA in the United States, or eIDAS in the EU). Certain document types, such as wills or some property transfers, may require additional formalities.

Contract templates are provided for convenience and are not legal advice. Have important agreements reviewed by a qualified lawyer.

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please run linting (`npm run lint` in `frontend/`) and the backend tests (`python manage.py test` in `backend/`) before submitting.

---

## License

Add your license here (for example, MIT). If no license is specified, all rights are reserved by the author.