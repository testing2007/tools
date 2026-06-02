from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

try:
    import yt_dlp
except ImportError:  # pragma: no cover - only used when dependency is missing
    yt_dlp = None


DEFAULT_URL = (
    "https://www.facebook.com/AppleboxasiaProductionHouse/videos/"
    "tiger-beer/308651900471741/"
)


def parse_cookies_from_browser(value: str | None) -> tuple[str, ...] | None:
    if not value:
        return None

    parts = [part.strip() for part in value.split(":") if part.strip()]
    if not parts:
        raise argparse.ArgumentTypeError(
            "cookies browser cannot be empty. Example: edge or chrome:Default"
        )
    return tuple(parts)


def build_options(args: argparse.Namespace) -> dict[str, Any]:
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    options: dict[str, Any] = {
        "format": args.format,
        "merge_output_format": "mp4",
        "outtmpl": str(output_dir / "%(title).200B [%(id)s].%(ext)s"),
        "noplaylist": True,
        "retries": 10,
        "fragment_retries": 10,
        "concurrent_fragment_downloads": 4,
        "ignoreerrors": False,
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            )
        },
    }

    if args.cookies:
        options["cookiefile"] = str(Path(args.cookies).expanduser().resolve())

    cookies_from_browser = parse_cookies_from_browser(args.cookies_from_browser)
    if cookies_from_browser:
        options["cookiesfrombrowser"] = cookies_from_browser

    if args.proxy:
        options["proxy"] = args.proxy

    if args.verbose:
        options["verbose"] = True

    return options


def print_info(info: dict[str, Any]) -> None:
    title = info.get("title") or "(unknown title)"
    video_id = info.get("id") or "(unknown id)"
    duration = info.get("duration")
    uploader = info.get("uploader") or info.get("channel") or "(unknown uploader)"

    print(f"Title: {title}")
    print(f"ID: {video_id}")
    print(f"Uploader: {uploader}")
    if duration is not None:
        print(f"Duration: {duration}s")

    formats = info.get("formats") or []
    if formats:
        print("\nAvailable formats:")
        for item in formats:
            format_id = item.get("format_id", "?")
            ext = item.get("ext", "?")
            resolution = item.get("resolution") or item.get("format_note") or "audio/video"
            filesize = item.get("filesize") or item.get("filesize_approx")
            size_text = f", ~{filesize / 1024 / 1024:.1f} MiB" if filesize else ""
            print(f"  {format_id:>12}  {ext:<5}  {resolution}{size_text}")


def print_direct_urls(info: dict[str, Any]) -> None:
    requested = info.get("requested_downloads") or []
    if requested:
        for item in requested:
            direct_url = item.get("url")
            if direct_url:
                print(direct_url)
        return

    formats = info.get("formats") or []
    for item in formats:
        direct_url = item.get("url")
        if not direct_url:
            continue

        format_id = item.get("format_id", "?")
        ext = item.get("ext", "?")
        resolution = item.get("resolution") or item.get("format_note") or "audio/video"
        print(f"{format_id}\t{ext}\t{resolution}\t{direct_url}")


def run(args: argparse.Namespace) -> int:
    if yt_dlp is None:
        print(
            "Missing dependency: yt-dlp. Install it with: python -m pip install -U yt-dlp",
            file=sys.stderr,
        )
        return 2

    options = build_options(args)

    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            if args.info_only or args.print_url:
                info = ydl.extract_info(args.url, download=False)
                if not info:
                    print("No media info was returned.", file=sys.stderr)
                    return 1

                if args.print_url:
                    print_direct_urls(info)
                else:
                    print_info(info)

                return 0

            ydl.download([args.url])
            print(f"\nSaved to: {Path(args.output_dir).expanduser().resolve()}")
            return 0

    except yt_dlp.utils.DownloadError as exc:
        print(f"Download failed: {exc}", file=sys.stderr)
        print(
            "\nIf this Facebook video needs login, try one of these:\n"
            "  python main.py --cookies-from-browser edge\n"
            "  python main.py --cookies-from-browser chrome\n"
            "  python main.py --cookies path\\to\\cookies.txt",
            file=sys.stderr,
        )
        return 1


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract or download a Facebook video with yt-dlp."
    )
    parser.add_argument(
        "url",
        nargs="?",
        default=DEFAULT_URL,
        help="Facebook video URL. Defaults to the Tiger Beer video URL.",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default="downloads",
        help="Directory for downloaded files. Default: downloads",
    )
    parser.add_argument(
        "-f",
        "--format",
        default="bv*+ba/b",
        help="yt-dlp format selector. Default: bv*+ba/b",
    )
    parser.add_argument(
        "--cookies",
        help="Path to a Netscape cookies.txt file exported from your browser.",
    )
    parser.add_argument(
        "--cookies-from-browser",
        help="Read cookies from a browser, e.g. edge, chrome, firefox, or chrome:Default.",
    )
    parser.add_argument(
        "--proxy",
        help="Proxy URL passed to yt-dlp, e.g. http://127.0.0.1:7890",
    )
    parser.add_argument(
        "--info-only",
        action="store_true",
        help="Only print media metadata and available formats.",
    )
    parser.add_argument(
        "--print-url",
        action="store_true",
        help="Only print extracted direct media URL(s), without downloading.",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose yt-dlp logs.",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(run(parse_args(sys.argv[1:])))
