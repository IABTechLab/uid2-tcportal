package_version=$(cat package.json | jq -r '.version')
echo $package_version