import ssl
import sys
import urllib.request
from pathlib import Path
import zipfile

def main():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    out_dir = Path("backend/predictive_quality_data/raw")
    out_dir.mkdir(parents=True, exist_ok=True)

    urls = [
        ("secom.zip", "https://archive.ics.uci.edu/static/public/179/secom.zip"),
        ("secom.data", "https://archive.ics.uci.edu/ml/machine-learning-databases/secom/secom.data"),
        ("secom_labels.data", "https://archive.ics.uci.edu/ml/machine-learning-databases/secom/secom_labels.data"),
        ("secom.names", "https://archive.ics.uci.edu/ml/machine-learning-databases/secom/secom.names"),
    ]

    for fname, url in urls:
        target = out_dir / fname
        print(f"Attempting download of {fname} from {url}...")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                content = resp.read()
                target.write_bytes(content)
                print(f"  SUCCESS: Downloaded {fname} ({len(content)} bytes)")
                
                if fname.endswith(".zip"):
                    try:
                        with zipfile.ZipFile(target, "r") as z:
                            z.extractall(out_dir)
                            print(f"  Extracted zip contents: {z.namelist()}")
                    except Exception as ze:
                        print(f"  Zip extraction failed: {ze}")
        except Exception as e:
            print(f"  FAILED {fname}: {e}")

if __name__ == "__main__":
    main()
