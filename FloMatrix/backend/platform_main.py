# backend/platform_main.py

from backend.provider_manager import ProviderManager

def main():
    pm = ProviderManager()

    print("\n=== Trading Platform Provider Manager ===\n")
    print("Commands:")
    print("  binance         → start Binance WS/L2 feed")
    print("  bybit           → start Bybit WS/L2 feed")
    print("  dxfeed          → start dxFeed stocks/futures/L2")
    print("  stop            → stop current provider")
    print("  quit            → exit manager")
    print("---------------------------------------------\n")

    while True:
        cmd = input("provider> ").strip().lower()

        if cmd == "quit":
            pm.stop()
            break

        elif cmd == "stop":
            pm.stop()
            print("Provider stopped.")

        elif cmd == "dxfeed":
            # You can change default symbols here
            symbols = ["AAPL", "MSFT", "ESZ24"]
            pm.start_provider("dxfeed", symbols=symbols)

        elif cmd in ("binance", "bybit"):
            pm.start_provider(cmd)

        else:
            print("Unknown command.")

    print("Exiting Provider Manager.")

if __name__ == "__main__":
    main()
