"""The phone app's engine layer: the same API answered without a server (as it runs on the phone)."""
import json
import os
import subprocess
import sys
import textwrap

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)


def test_local_api_answers_like_the_server(tmp_path):
    # runs in a fresh Python with the FastAPI stand-in first on the path, exactly like the phone app
    script = textwrap.dedent(f"""
        import sys, json, asyncio
        sys.path[:0] = [{os.path.join(BACKEND, 'standalone')!r}, {BACKEND!r}]
        import fastapi
        assert hasattr(fastapi, 'ROUTES'), 'the stand-in must shadow the real FastAPI'
        from lifeos import local_api
        from tests.test_story import spec
        info = local_api.boot({str(tmp_path / 'saves')!r})
        call = lambda m, p, b=None, q='': asyncio.run(local_api.handle(m, p, q, None if b is None else (b if isinstance(b, bytes) else json.dumps(b).encode())))
        js = lambda r: json.loads(r['body'])
        s = spec(per=6); s['family']['pet'] = {{'species': 'dog', 'name': 'Buster'}}
        assert call('POST', '/api/story/new', {{'spec': s}})['status'] == 200
        st = js(call('GET', '/api/phone/state'))
        assert st['active'] and st['moments'] and st['pets'][0]['name'] == 'Buster'
        assert call('POST', f"/api/phone/moment/{{st['moments'][0]['id']}}", {{'index': 0}})['status'] == 200
        assert js(call('POST', '/api/story/advance', {{'until': 'decision'}}))['status'] == 'done'
        r = call('POST', '/api/story/advance', {{'until': 'moment'}})
        assert js(r)['status'] == 'running'
        while local_api.pump(0.2):
            pass
        assert js(call('GET', '/api/sim/job'))['status'] == 'done'
        assert call('GET', '/api/phone/threads')['status'] == 200
        assert call('GET', '/api/characters/zack-soffer')['status'] == 200
        assert call('GET', '/api/nope')['status'] == 404
        assert call('POST', '/api/story/control', {{'focus': 'nonsense'}})['status'] == 422
        b = call('GET', '/api/phone/backup')
        assert b['status'] == 200 and len(b['body']) > 1000
        assert local_api.flush() or True
        assert js(call('POST', '/api/phone/restore', b['body']))['story']
        from lifeos import api
        assert api.lab.w.rules['history.event_window_days'] == 21, 'the phone keeps history lean'
        print('OK', info['routes'])
    """)
    out = subprocess.run([sys.executable, "-c", script], cwd=BACKEND, capture_output=True, text=True, timeout=300)
    assert out.returncode == 0, out.stderr[-3000:]
    assert out.stdout.strip().startswith("OK")
