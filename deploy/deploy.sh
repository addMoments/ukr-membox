set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source $SCRIPT_DIR/.env


echo "Deploying to $AWS_BUCKET via $SCRIPT_DIR"

BUILD_DIR="$SCRIPT_DIR/../build"

find $BUILD_DIR -name ".DS_Store" -delete

# 12 Kasim 2026'dan beri canli depo Cloudflare R2 (addmoments-media): .env'de S3_ENDPOINT_URL verilir (ornek
# https://<account_id>.eu.r2.cloudflarestorage.com; AWS_* anahtarlari o zaman R2 anahtarlaridir). Build'in
# varsayilan PUBLIC_URL'i https://media.addmoments.com.ua/ui (package.json); ortamdan ezilebilir. R2'ye yazmak rclone ile yapilir: AWS CLI 2.23'un "aws s3 cp/sync"i R2'de ara ara
# SignatureDoesNotMatch veriyor (aws-chunked + CRC64NVME trailer gonderiyor, when_required ayari da
# yetmiyor; 11 Kasim test bucket'inda goruldu). S3_ENDPOINT_URL yoksa asagidaki eski S3 yolu calisir (yalniz geri donus icin).
if [ -n "${S3_ENDPOINT_URL:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "S3_ENDPOINT_URL verilmis ama rclone yok: brew install rclone" >&2
    exit 1
  fi
  echo "endpoint: $S3_ENDPOINT_URL (rclone)"
  export RCLONE_CONFIG_R2_TYPE=s3
  export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
  export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
  export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_R2_ENDPOINT="$S3_ENDPOINT_URL"
  export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
  # Ayni cache politikasi; silme yok (eski asset'ler geri donus yolu). --checksum: icerigi ayni dosyaya
  # dokunmaz (yalniz mtime farki icin nesneyi yeniden yazip basliklarini degistirmesin).
  rclone copy --checksum "$BUILD_DIR/static" "r2:$AWS_BUCKET/ui/static" \
    --header-upload "Cache-Control: public, max-age=31536000, immutable"
  rclone copy --checksum "$BUILD_DIR" "r2:$AWS_BUCKET/ui" --exclude "static/**" \
    --header-upload "Cache-Control: no-cache"
else
  # Hash'li dosyalar (static/**): icerigi degisince adi da degisir, sonsuza kadar cache'lenebilir.
  aws s3 sync "$BUILD_DIR/static" "s3://$AWS_BUCKET/ui/static" \
    --cache-control "public, max-age=31536000, immutable"

  # Sabit isimli dosyalar (assets/lang/*.json, header/footer css, hfSetup.js, gorseller):
  # her deploy'da icerik degisir ama ad ayni kalir -> tarayici her istekte dogrulamali,
  # yoksa heuristic cache yuzunden eski ceviriler/stiller takili kalir.
  aws s3 sync "$BUILD_DIR" "s3://$AWS_BUCKET/ui" --exclude "static/*" \
    --cache-control "no-cache"
fi

# HTML shell en son: yeni asset'ler S3'te hazir olmadan kimse yeni index'i gormesin.
# --delete bilerek yok: eski asset'ler tek geri donus yolu, S3 versioning kapali.
curl --fail --user "$FTP_USERNAME:$FTP_PASSWORD" -T "$BUILD_DIR/index.html" "ftp://$FTP_HOST/public_html/reactApp.html"

echo "deploy tamam - canlidaki HTML hangi bundle'i gosteriyor:"
curl -s https://addmoments.com.ua/reactApp.html | grep -o 'static/js/main\.[A-Za-z0-9_-]*\.js' | head -1
