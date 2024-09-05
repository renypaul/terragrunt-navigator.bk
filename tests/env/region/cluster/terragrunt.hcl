terraform {
    #source = "git::https://github.com/terraform-aws-modules/terraform-aws-eks.git//modules/aws-auth?ref=${read_terragrunt_config(find_in_parent_folders("vpc.hcl")).locals.version}"
    source = "../../vpc"
}

include {
    path = find_in_parent_folders()
}

# dependency "vpc" {
#   config_path = "../../vpc"
# }

inputs = {
 region_code = "us-east-1"
}
