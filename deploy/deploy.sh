SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
source $SCRIPT_DIR/.env


echo "Deploying to $AWS_BUCKET via $SCRIPT_DIR"

BUILD_DIR="$SCRIPT_DIR/../build"

find $BUILD_DIR -name ".DS_Store" -delete

aws s3 sync "$BUILD_DIR" "s3://$AWS_BUCKET/ui" --delete

curl --user "$FTP_USERNAME:$FTP_PASSWORD" -T "$BUILD_DIR/index.html" "ftp://$FTP_HOST/public_html/reactApp.html"