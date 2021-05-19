import asyncio
import websockets
import time
from tqdm import tqdm
import os

port = os.environ.get("PORT") or "8080"

url = f"ws://localhost:{port}/echo"

async def main():
	conns: websockets.ClientConnection = await asyncio.gather(*[websockets.connect(url) for _ in range(2000)])
	print("all clients connected")
	while True:

		# start = None
		# for conn in tqdm(conns):
		# 	await conn.recv()
		# 	if not start:
		# 		print("start")
		# 		start = time.time()
		# end = time.time()
		# print(f"time to receive all messages: {end - start}s")

		start = None
		for coro in asyncio.as_completed([conn.recv() for conn in conns]):
			await coro
			if not start:
				print("start")
				start = time.time()
		end = time.time()
		print(f"time to receive all messages: {end - start}s")


asyncio.get_event_loop().run_until_complete(main())
