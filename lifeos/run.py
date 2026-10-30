"""Start the LIFE OS laboratory: python run.py  (then open http://127.0.0.1:8765)"""
import argparse
import os
import sys
import threading
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "backend"))


def main():
    ap = argparse.ArgumentParser(description="LIFE OS - Living World Laboratory")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true", help="don't open a browser tab")
    ap.add_argument("--fresh", action="store_true", help="ignore the autosave and start the demo world over")
    args = ap.parse_args()
    import uvicorn
    from lifeos import api
    from lifeos.storage import Store
    print("Loading the world...")
    api.lab = api.Lab(Store(), fresh=args.fresh)
    url = f"http://{args.host}:{args.port}"
    print(f"LIFE OS is running at {url}  (Ctrl+C to stop)")
    if not args.no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run(api.app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
