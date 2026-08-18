set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source $SCRIPT_DIR/.env


echo "Deploying to $AWS_BUCKET via $SCRIPT_DIR"

BUILD_DIR="$SCRIPT_DIR/../build"

find $BUILD_DIR -name ".DS_Store" -delete

# Hash'li dosyalar (static/**): icerigi degisince adi da degisir, sonsuza kadar cache'lenebilir.
aws s3 sync "$BUILD_DIR/static" "s3://$AWS_BUCKET/ui/static" \
  --cache-control "public, max-age=31536000, immutable"

# Sabit isimli dosyalar (assets/lang/*.json, header/footer css, hfSetup.js, gorseller):
# her deploy'da icerik degisir ama ad ayni kalir -> tarayici her istekte dogrulamali,
# yoksa heuristic cache yuzunden eski ceviriler/stiller takili kalir.
aws s3 sync "$BUILD_DIR" "s3://$AWS_BUCKET/ui" --exclude "static/*" \
  --cache-control "no-cache"

# HTML shell en son: yeni asset'ler S3'te hazir olmadan kimse yeni index'i gormesin.
# --delete bilerek yok: eski asset'ler tek geri donus yolu, S3 versioning kapali.
curl --fail --user "$FTP_USERNAME:$FTP_PASSWORD" -T "$BUILD_DIR/index.html" "ftp://$FTP_HOST/public_html/reactApp.html"

echo "deploy tamam - canlidaki HTML hangi bundle'i gosteriyor:"
curl -s https://addmoments.com.ua/reactApp.html | grep -o 'static/js/main\.[A-Za-z0-9_-]*\.js' | head -1
