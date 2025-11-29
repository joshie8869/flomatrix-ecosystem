# backend/provider_manager.py

import multiprocessing
import time

# --- Provider entrypoints ---
from backend.data_engines.binance_stream import run_stream as run_binance
# If you have Bybit implemented, uncomment this:
# from backend.data_engines.bybit_stream import run_bybit_stream
from backend.data_engines.dxfeed.dxfeed_stream import run_dxfeed
from backend.data_engines.okx.okx_stream import run_okx_stream


# Dictionary of all available providers and their entrypoints
PROVIDERS = {
    "binance": run_binance,
    # "bybit": run_bybit_stream,   # ← enable when ready
    "dxfeed": run_dxfeed,
    "okx": run_okx_stream,         # ← NEW OKX PROVIDER
}


class ProviderManager:
    """
    Launches a data provider (binance / okx / dxfeed / bybit)
    in a SEPARATE PROCESS so it does not block the API or UI.

    Automatically stops the old provider when switching.
    """

    def __init__(self):
        self.current_provider = None     # name of current provider
        self.process = None              # multiprocessing.Process object

    # ----------------------------------------------------
    # INTERNAL: start a provider in a new process
    # ----------------------------------------------------
    def _start_process(self, func, args=None):
        if args is None:
            args = []

        p = multiprocessing.Process(
            target=func,
            args=args,
            daemon=True
        )
        p.start()
        return p

    # ----------------------------------------------------
    # PUBLIC: start a provider by name
    # ----------------------------------------------------
    def start_provider(self, provider_name, *args):
        """
        Start a new provider (binance / okx / dxfeed / bybit)
        and kill any provider already running.
        """
        provider_name = provider_name.lower()

        if provider_name not in PROVIDERS:
            raise ValueError(f"Unknown provider: {provider_name}")

        # Stop old provider if running
        if self.process is not None and self.process.is_alive():
            print(f"[ProviderManager] Stopping previous provider: {self.current_provider}")
            self.process.terminate()
            self.process.join()

        # Select the correct provider entrypoint
        func = PROVIDERS[provider_name]

        # Start provider in new process
        print(f"[ProviderManager] Starting provider: {provider_name}")
        self.process = self._start_process(func, args)

        self.current_provider = provider_name
        return True

    # ----------------------------------------------------
    # PUBLIC: stop whatever provider is running
    # ----------------------------------------------------
    def stop(self):
        """
        Stop the currently running provider process.
        """
        if self.process is not None and self.process.is_alive():
            print(f"[ProviderManager] Stopping provider: {self.current_provider}")
            self.process.terminate()
            self.process.join()

        self.process = None
        self.current_provider = None

    # ----------------------------------------------------
    # PUBLIC: return current provider name
    # ----------------------------------------------------
    def get_current(self):
        return self.current_provider
