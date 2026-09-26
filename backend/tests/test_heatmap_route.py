import pytest
from fastapi import HTTPException
from app.routes import heatmap as module


def test_combine_missing_changes():
    root={'children':[{'name':'Tech','children':[{'name':'Software','children':[
        {'name':f'S{i}','value':i+1} for i in range(120)]}]}]}
    result=module.combine(root,{'nodes':{'S0':0,'S1':-2.5}})
    assert len(result)==120
    assert result[0]['changePercent']==0
    assert result[1]['changePercent']==-2.5
    assert result[2]['changePercent'] is None
    assert result[-1]['marketCap']==120


def test_parser_preserves_strings_and_rejects_code():
    raw='.exports={name:"Root",children:[{name:"value: title",value:2}]}}}]);'
    assert module.parse_universe(raw)['children'][0]['name']=='value: title'
    with pytest.raises(ValueError):
        module.parse_universe('.exports=alert(1)')


def test_cached_snapshot_survives_outage(monkeypatch):
    monkeypatch.setattr(module,'_snapshot',{'stocks':[],'fetchedAt':'earlier'})
    monkeypatch.setattr(module,'_refreshed',0)
    def fail(_): raise ValueError('unavailable')
    monkeypatch.setattr(module,'universe',fail)
    result=module.heatmap()
    assert result['stale'] is True
    assert result['fetchedAt']=='earlier'


def test_initial_outage_is_explicit(monkeypatch):
    monkeypatch.setattr(module,'_snapshot',None)
    def fail(_): raise ValueError('unavailable')
    monkeypatch.setattr(module,'universe',fail)
    with pytest.raises(HTTPException) as exc:
        module.heatmap()
    assert exc.value.status_code==503


def test_heatmap_declares_market_cap_units(monkeypatch):
    monkeypatch.setattr(module, '_snapshot', None)
    monkeypatch.setattr(module, 'universe', lambda _: {
        'children': [{'name': 'Tech', 'children': [{'name': 'Software', 'children': [
            {'name': f'S{i}', 'description': f'Stock {i}', 'value': i + 1}
            for i in range(120)
        ]}]}]
    })
    monkeypatch.setattr(module, 'fetch_public', lambda _: '{"nodes": {}}')

    result = module.heatmap()

    assert result['marketCapUnit'] == 'USD millions'
