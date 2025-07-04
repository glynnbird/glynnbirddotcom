# Basic project
resource "cloudflare_pages_project" "frontend_project" {
  account_id        = var.cloudflare_account_id
  name              = "glynnbirddotcom"
  production_branch = "main"
  
  build_config = {
    build_command       = "./build.sh"
    destination_dir     = "frontend/dist"
    root_dir            = "/"
  }

  source = {
    type = "github"
    config = {
      owner                         = "glynnbird"
      repo_name                     = "glynnbirddotcom"
      production_branch             = "main"
    }
  }
    deployment_configs = {
      preview = {
        env_vars = {
          NODE_VERSION = {
            type = "plain_text"
            value = "22"
          }
        }
      }
      production = {
        env_vars = {
          NODE_VERSION = {
            type = "plain_text"
            value = "22"
          }
        }
      }
  }
}

resource "cloudflare_pages_domain" "frontend_domain" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.frontend_project.name
  name       = var.cloudflare_domain
}

resource "cloudflare_dns_record" "frontend_dns" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content   = cloudflare_pages_project.frontend_project.subdomain
  type    = "CNAME"
  ttl     = 3600
}
