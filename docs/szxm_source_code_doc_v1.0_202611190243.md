# 《塞得下吗》群核 Aholo 技术接入与源代码文档

> 参赛作品：《塞得下吗》（Aholo 全球 3D AI 黑客松）　｜　文档版本 v1.0　｜　配套产品版本 v100
>
> 本文档说明本项目如何在产品中接入群核（Aholo / Manycore）自研技术栈：Lux3D 模型生成（本轮 9 个品类真实资产重建）、世界重建与生成、云端渲染（渲染云）、材质与模型生成与资产管线。凡是已真实跑通并产生产物的能力，均由实测数据、真实任务 ID、真实资产体积支撑；凡属方案设计而未落地验证的，一律显式标注 **[规划/未落地]**，不作已实现表述。

## 目录

| 章 | 标题 | 落地状态 |
|---|---|---|
| 1 | 项目总纲与群核技术选型 | 已落地 |
| 2 | Lux3D 模型生成 API 接入 | 已落地（真实调用） |
| 3 | 世界重建与生成 | 部分落地（上传链路实证）；场景应用为规划 |
| 4 | 云端渲染（渲染云） | 接口梳理；项目内应用为规划 |
| 5 | 材质与模型生成 | 已落地（3DGS 材质修复 + 标准 PBR） |
| 6 | 生成资产流入产品的接入链路 | 已落地（减面 → 量化 → 烘焙 → 回归） |
| 7 | 8 品类批量生成工程参数与实测数据 | 已落地（8 次真实任务） |
| 8 | 全链路错误台账与复现步骤 | 已落地（本轮实际踩坑与修法） |

---

## 1 项目总纲与群核技术选型

### 1.1 项目定位与游戏机制

《塞得下吗》是 Aholo 全球 3D AI 黑客松参赛作品，定位为三人称视角 3D 收纳益智游戏。玩家将家具、家电等物品装入有限尺寸的收纳仓，判断它们能否放下；仓位包括 S 100、M 150、L 200、XL 300，以及约 430 cm 的货车。判定需要考虑物品堆叠、可否侧放和六面旋转姿态，而不只是比较单一尺寸。

### 1.2 群核技术选型与架构边界

比赛要求作品结合群核（Aholo / Manycore）自研技术。本项目选用的能力包括 Lux3D 模型生成（图生 3D、文生 3D、材质生成）、世界重建与生成、云端渲染（渲染云），以及材质与模型生成。其中，有明确资产改造记录的是 **R31 使用 Lux3D 批量重建 9 个原占位盒品类**；其余能力在现有现有资料中没有接口调用或运行链路记录，不将其扩写为已实现的接入流程。

相较于继续自建低模，选用 Lux3D 的目的是提高参赛资产的几何与材质表现，并以“较高面密度、角色或器物不跑型”作为质量目标；现有资料未提供面数、对照实验或验收结果，因此这里不将该目标表述为量化结论。运行时则保留另一项明确的工程取舍：**所有 3D 模型内联于 `window.MESH_DATA`**，不使用运行时 `GLTFLoader` 或外部 CDN，以满足离线可用、快速加载的既有架构。Lux3D 的在线生成与产物获取属于资产制作阶段，不等同于游戏运行时联网加载模型。

```text
《塞得下吗》
├─ 游戏机制
│  ├─ 三人称视角与收纳仓
│  └─ 装箱判定：堆叠／侧放限制／六面旋转
├─ 资产制作
│  ├─ 7 个早期真实几何品类
│  └─ 9 个 R31 Lux3D 批量重建品类
├─ 群核技术选型
│  ├─ Lux3D：图生 3D／文生 3D／材质生成
│  ├─ 世界重建与生成
│  ├─ 云端渲染（渲染云）
│  └─ 材质与模型生成
└─ 游戏运行时
   └─ window.MESH_DATA 内联模型
      ├─ 不使用运行时 GLTFLoader
      └─ 不依赖外部 CDN
```

### 1.3 资产盘点

“真实几何”与“占位盒”描述的是本项目的资产状态，不表示 Lux3D 任务所使用的具体输入方式。现有现有资料未给出各品类分别采用文生、图生或多图生 3D 的记录。

| 品类 | 是否真实几何 | 生成来源 | 备注 |
|---|---|---|---|
| `box` | 是 | 早期资产；具体来源未提供 | 7 个早期真实几何品类之一 |
| `suitcase` | 是 | 早期资产；具体来源未提供 | 同上 |
| `bike` | 是 | 早期资产；具体来源未提供 | 同上 |
| `sofa` | 是 | 早期资产；具体来源未提供 | 同上 |
| `mattress` | 是 | 早期资产；具体来源未提供 | 同上 |
| `fridge` | 是 | 早期资产；具体来源未提供 | 同上 |
| `shelf` | 是 | 早期资产；具体来源未提供 | 同上 |
| `washer` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |
| `wardrobe` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |
| `treadmill` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |
| `foldingtable` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |
| `chair` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |
| `coffeetable` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |
| `storagebox` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |
| `tv` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |
| `mirror` | 是 | R31 Lux3D 批量重建 | 原为占位盒 |

## 2 Lux3D 模型生成 API 接入

### 2.1 网关、认证与请求约束

Lux3D 使用 `https://api.aholo.cn` 作为网关；现有资料记录其与 `api.aholo3d.cn` 为同一网关。接入代码允许通过环境变量 `LUX3D_BASE_URL` 覆盖默认地址。认证头必须写作：

```http
Authorization: <API Key>
```

**不要添加 `Bearer` 前缀。** API Key 应从运行环境读取，不写入源代码或提交到资产文件中。

| 能力 | 方法与路径 | 已知请求字段 | 已知响应或产物字段 |
|---|---|---|---|
| 文生 3D | `POST /lux3d/v1/generate/text-to-3d/task/create` | `version`、`prompt`、`style`；可选 `name`、`img`，其中 `img` 为 data URL | 创建响应的具体任务 ID 字段名未见现有资料记录；取得任务 ID 后使用统一查询端点 |
| 图生 3D | `POST /lux3d/v1/generate/img-to-3d/task/create` | `version`、`img`、`faceCount`、`outputFormat`、`enablePbr` | 同上；本地图输入须经 OUS 上传 |
| 多图生 3D | `POST /lux3d/v1/generate/multi-image-to-3d/task/create` | `imgs` 数组 | 同上；其他可选字段未见现有资料记录 |
| 查询任务 | `GET /lux3d/v1/generate/task/get?taskid=XXX` | 查询参数 **`taskid`**，全小写 | `d.status`；成功后读取 `d.outputs` |
| 列出任务 | `GET /lux3d/v1/generate/task/list?page=&pageSize=` | `page`、`pageSize` | 列表响应结构未见现有资料记录 |

文生 3D 的 `style` 已知枚举为 `photorealistic`、`cartoon`、`anime`、`hand_painted`、`cyberpunk`、`fantasy`、`glass`。`faceCount`、`outputFormat`、`enablePbr` 是图生 3D 字段，**不能复制进文生 3D 请求**：实测多传这些字段会得到 HTTP 400，省略后请求成功。

### 2.2 任务状态与产物

查询响应中的 `d.status` 按已知含义处理：

| 状态值 | 含义 | 客户端动作 |
|---|---|---|
| `0` | 排队 | 继续查询 |
| `1` | 处理中 | 继续查询 |
| `3` | 成功 | 读取 `d.outputs` 并获取产物 |
| `4` | 失败 | 停止轮询并记录响应 |
| `6` | 现有资料未给出含义 | 不推断为成功或失败，保留原始响应供排查 |

成功任务的产物位置已验证为：

- `d.outputs[0].content`：`result.zip` 的 COS 签名 URL。链接约 **2 小时后过期**，成功后须及时下载，不能把该 URL 当作长期资产地址。
- `d.outputs[1].content`：`textured.glb` 的 CDN 地址，不是上述签名 URL。
- `result.zip`：包含 `MODEL.glb` 和 **6 张 Raw PBR 滤镜贴图**；现有资料将贴图描述为 3DGS 多视角烘焙产物。贴图具体文件名未提供，不应在脚本中预设文件名。

以上是生成服务的交付形式。游戏运行时使用的是 `window.MESH_DATA` 内联资产；现有资料没有提供从 `MODEL.glb` 到内联数据的转换实现，本章不虚构转换步骤。

### 2.3 Python `requests` 调用示例

以下脚本覆盖三类任务创建、任务查询、列表查询，以及成功后的 ZIP 下载与内容检查。它**不猜测创建响应中的任务 ID 字段名**：先输出服务端响应，再由调用者将实际任务 ID 设置为 `LUX3D_TASK_ID` 执行查询。

**[规划/未落地]** 示例采用每 10 秒查询一次、单任务最多查询 60 次和串行提交；这些是示例客户端的保护参数，不是 Lux3D 官方限额。本地图像的 OUS 上传地址与请求协议未见现有资料记录，因此图生／多图示例要求调用者提供已准备好的 `img` 引用，不把本地文件路径直接伪装成可用的 `img`。

```python
# 依赖：pip install requests
#
# 必需：LUX3D_API_KEY
# 创建任务：LUX3D_MODE=text|image|multi
# 查询任务：LUX3D_MODE=poll，另设 LUX3D_TASK_ID
# 任务列表：LUX3D_MODE=list
#
# 各创建模式的输入由相应环境变量提供；不要在代码中硬编码 API Key。

import json
import os
import time
import zipfile
from io import BytesIO
from pathlib import Path

import requests


BASE_URL = os.getenv("LUX3D_BASE_URL", "https://api.aholo.cn").rstrip("/")
API_KEY = os.environ["LUX3D_API_KEY"]
MODE = os.getenv("LUX3D_MODE", "text")
TIMEOUT_SECONDS = 30

session = requests.Session()
session.headers.update({
    "Authorization": API_KEY,  # 无 Bearer 前缀
    "Content-Type": "application/json",
})


def api_request(method, path, **kwargs):
    response = session.request(
        method,
        f"{BASE_URL}{path}",
        timeout=TIMEOUT_SECONDS,
        **kwargs,
    )
    if not response.ok:
        raise RuntimeError(
            f"HTTP {response.status_code}: {response.text[:2000]}"
        )
    try:
        return response.json()
    except ValueError as exc:
        raise RuntimeError(
            f"服务端未返回可解析的 JSON: {response.text[:2000]}"
        ) from exc


def create_text_task():
    payload = {
        "version": os.environ["LUX3D_TEXT_VERSION"],
        "prompt": os.environ["LUX3D_PROMPT"],
        "style": os.getenv("LUX3D_STYLE", "photorealistic"),
    }
    if os.getenv("LUX3D_NAME"):
        payload["name"] = os.environ["LUX3D_NAME"]
    if os.getenv("LUX3D_TEXT_IMG_DATA_URL"):
        payload["img"] = os.environ["LUX3D_TEXT_IMG_DATA_URL"]
    # 不向此端点传 faceCount / outputFormat / enablePbr。
    return api_request(
        "POST",
        "/lux3d/v1/generate/text-to-3d/task/create",
        json=payload,
    )


def create_image_task():
    payload = {
        "version": os.environ["LUX3D_IMAGE_VERSION"],
        "img": os.environ["LUX3D_IMAGE_REF"],
        "faceCount": int(os.environ["LUX3D_FACE_COUNT"]),
        "outputFormat": os.environ["LUX3D_OUTPUT_FORMAT"],
        "enablePbr": os.environ["LUX3D_ENABLE_PBR"].lower() == "true",
    }
    return api_request(
        "POST",
        "/lux3d/v1/generate/img-to-3d/task/create",
        json=payload,
    )


def create_multi_image_task():
    imgs = json.loads(os.environ["LUX3D_IMGS_JSON"])
    if not isinstance(imgs, list) or not imgs:
        raise ValueError("LUX3D_IMGS_JSON 必须是非空 JSON 数组")
    return api_request(
        "POST",
        "/lux3d/v1/generate/multi-image-to-3d/task/create",
        json={"imgs": imgs},
    )


def get_task(taskid):
    return api_request(
        "GET",
        "/lux3d/v1/generate/task/get",
        params={"taskid": taskid},  # 必须为全小写 taskid
    )


def list_tasks(page=1, page_size=10):
    return api_request(
        "GET",
        "/lux3d/v1/generate/task/list",
        params={"page": page, "pageSize": page_size},
    )


def poll_task(taskid):
    # **[规划/未落地]** 轮询间隔和次数是示例策略，并非服务端返回值。
    for _ in range(60):
        result = get_task(taskid)
        data = result.get("d")
        if not isinstance(data, dict):
            raise RuntimeError(f"缺少任务数据 d: {result}")
        status = data.get("status")

        if status == 3:
            return data
        if status == 4:
            raise RuntimeError(f"任务失败，原始响应: {result}")
        if status not in (0, 1):
            raise RuntimeError(f"未定义的任务状态 {status!r}: {result}")
        time.sleep(10)

    raise TimeoutError("达到示例轮询次数上限；可稍后凭 taskid 再查")


def download_result_zip(task_data, destination="result.zip"):
    outputs = task_data.get("outputs")
    if not isinstance(outputs, list) or len(outputs) < 2:
        raise RuntimeError(f"成功任务缺少预期产物: {outputs!r}")

    zip_url = outputs[0].get("content")
    glb_url = outputs[1].get("content")
    if not zip_url or not glb_url:
        raise RuntimeError(f"产物地址为空: {outputs!r}")

    # ZIP 是有时效的签名 URL；此请求不使用 API 网关认证头。
    response = requests.get(zip_url, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    zip_bytes = response.content

    with zipfile.ZipFile(BytesIO(zip_bytes)) as archive:
        names = archive.namelist()
        if "MODEL.glb" not in names:
            raise RuntimeError(f"ZIP 中未找到 MODEL.glb: {names}")

    Path(destination).write_bytes(zip_bytes)
    return {"zip_path": destination, "zip_members": names, "textured_glb": glb_url}


if __name__ == "__main__":
    if MODE == "text":
        result = create_text_task()
    elif MODE == "image":
        result = create_image_task()
    elif MODE == "multi":
        result = create_multi_image_task()
    elif MODE == "list":
        result = list_tasks()
    elif MODE == "poll":
        result = download_result_zip(
            poll_task(os.environ["LUX3D_TASK_ID"])
        )
    else:
        raise ValueError(f"不支持的 LUX3D_MODE: {MODE}")

    print(json.dumps(result, ensure_ascii=False, indent=2))
```

`LUX3D_TEXT_VERSION`、`LUX3D_IMAGE_VERSION`、`LUX3D_FACE_COUNT` 和 `LUX3D_OUTPUT_FORMAT` 应填入实际任务所需值；现有资料未提供这些字段的可用取值，示例不代填。**[规划/未落地]** 接入本地图像时，应先补齐并验证 OUS 上传步骤，再将其产出的有效引用用于图生或多图请求。

### 2.4 积分、并发与错误处理

| 任务类型 | 已知积分消耗 |
|---|---:|
| G1 图生 3D | 20 |
| G1-Turbo 文生 3D | 13 |
| 多图生 3D | 20 |
| Turbo 图生 3D | 1 |

免费账号的并发上限为 **5**。G1 文生 3D 单任务耗时约 **292 秒**，这是一次实测值，不应作为所有任务的固定完成时间。**[规划/未落地]** 批量生产时在客户端限制同时进行的任务数不超过 5，并按所选任务类型预估积分；不能仅凭提交成功就计入已完成资产。

| 情况 | 处理要点 |
|---|---|
| 文生 3D 返回 HTTP 400 | 先检查是否误传图生专用的 `faceCount`、`outputFormat`、`enablePbr`；文生请求只提交其适用字段。 |
| 查询返回 HTTP 400 | 检查查询参数是否写成了 `taskId`；正确拼写为全小写 `taskid`。 |
| ZIP 下载失败或签名失效 | 成功后立即下载 `outputs[0].content`；其签名 URL 约 2 小时过期。不要将其作为永久下载地址。 |
| `d.status == 4` | 按失败任务处理并保留原始响应；现有资料未规定更细的失败原因字段。 |
| `d.status == 6` 或其他未定义值 | 现有资料没有给出 `6` 的含义；停止自动成功判定，记录原始响应后核查。 |
| “reasoning”类异常 | **[规划/未落地]** 作为未分类服务端异常处理：保存 HTTP 状态、响应正文及相关任务 ID，暂停该任务的自动产物处理。现有资料没有给出此类异常的固定字段、成因或恢复规则，不据此编造重试条件。 |
| 本地图像无法直接用于图生任务 | 已知本地图输入会走 OUS 上传；现有资料未给出上传 API。先完成该环节的接口验证，不直接把本地路径作为 `img` 提交。 |

## 3 世界重建与生成

### 3.1 资产上传：取得可供接口使用的 URL

世界重建与生成使用图片、视频等现有资料前，须先将文件上传到对象存储，并取得上传状态接口返回的 `d.url`。流程为：

1. `GET /asset/v1/token`，取得 `ousToken`、`globalDomain` 和 `blockSize`。
2. 向 `{globalDomain}/ous/api/v2/single/upload` 直传文件字节：请求头携带 `ous-token-v2`，查询参数携带 `name`、`type`。
3. 从直传响应读取 **`obsTaskId`**，以该值作为 `taskId` 查询 `{globalDomain}/ous/api/v2/upload/status`；取得 `d.url` 后再提交世界任务。

以下脚本适用于**不超过接口返回的 `blockSize`** 的文件。沙箱实测该值约为 5 MB；更大的文件需改用分片上传，本节不臆造分片协议。平台鉴权方式未包含在现有现有资料中，脚本通过环境变量接收已配置好的 API 请求头。

```python
# upload_asset.py
# 用法：
#   pip install requests
#   export AHOLO_API_HEADERS_JSON='{"你的鉴权头名":"你的鉴权值"}'
#   python upload_asset.py ./view_01.jpg image

import json
import os
import sys
import time
from pathlib import Path

import requests

API_BASE = os.getenv("AHOLO_API_BASE", "https://api.aholo.cn").rstrip("/")
API_HEADERS = json.loads(os.getenv("AHOLO_API_HEADERS_JSON", "{}"))
TIMEOUT = 30


def check(response):
    response.raise_for_status()
    return response.json()


def upload(path: Path, asset_type: str) -> str:
    token = check(requests.get(
        f"{API_BASE}/asset/v1/token",
        headers=API_HEADERS,
        timeout=TIMEOUT,
    ))
    ous_token = token["ousToken"]
    domain = token["globalDomain"].rstrip("/")
    block_size = int(token["blockSize"])

    if path.stat().st_size > block_size:
        raise ValueError(
            f"{path.name} 超过 blockSize={block_size}；请改用分片上传"
        )

    with path.open("rb") as file:
        uploaded = check(requests.post(
            f"{domain}/ous/api/v2/single/upload",
            headers={"ous-token-v2": ous_token},
            params={"name": path.name, "type": asset_type},
            data=file,
            timeout=120,
        ))

    obs_task_id = uploaded["obsTaskId"]  # 不是 uploaded["taskId"]

    for _ in range(60):
        result = check(requests.get(
            f"{domain}/ous/api/v2/upload/status",
            headers={"ous-token-v2": ous_token},
            params={"taskId": obs_task_id},
            timeout=TIMEOUT,
        ))
        url = (result.get("d") or {}).get("url")
        if url:
            return url
        time.sleep(2)

    raise TimeoutError("上传状态查询超时；请保留 obsTaskId 排查")


if __name__ == "__main__":
    print(upload(Path(sys.argv[1]), sys.argv[2]))
```

`type` 的具体可用取值应以接入时的接口要求为准；命令行示例中的 `image` 不替代该项校验。若实际响应存在额外封装，应按实际响应结构调整取值位置。

### 3.2 世界重建：多视角现有资料转为 3D Gaussian Splatting 场景

提交端点为 `POST /world/v1/reconstructions`。任务提交后，通过 `GET /world/v1/{worldId}` 轮询；`SUCCEEDED` 表示成功，`FAILED` 表示失败，其余状态继续等待。

| 参数 | 已知用法 |
|---|---|
| `type` | `image`、`video` 或 `insv` |
| `images` | `type=image` 时提供；至少 **20 张**多视角图片，覆盖场景各角度，图片先上传并取得 URL |
| `scene` | `model` 表示整体场景；`space` 表示空间 |
| `taskQuality` | `low`、`normal`、`high` |
| `useMask` | 是否使用蒙版 |

`type=video` 使用单段视频。视频及 INSV 现有资料同样须先完成上传；除上述信息外，本现有资料未给出各类型请求体中现有资料字段的完整定义，实施时应对照相应接口定义组装，不能将图片字段直接套用于视频。

图片任务的请求与轮询逻辑可按以下方式组织；其中 `image_urls` 是上一节取得的 URL 列表：

```python
import time
import requests

def reconstruct_images(api_base, headers, image_urls):
    if len(image_urls) < 20:
        raise ValueError("image 模式至少需要 20 张多视角图片")

    response = requests.post(
        f"{api_base.rstrip('/')}/world/v1/reconstructions",
        headers=headers,
        json={
            "type": "image",
            "images": image_urls,
            "scene": "space",
            "taskQuality": "normal",
            "useMask": False,
        },
        timeout=30,
    )
    response.raise_for_status()
    submitted = response.json()

    # 按实际提交响应结构取得 worldId；不预设响应封装层级。
    world_id = submitted["worldId"]

    for _ in range(120):
        response = requests.get(
            f"{api_base.rstrip('/')}/world/v1/{world_id}",
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        world = response.json()
        status = world["status"]
        if status == "SUCCEEDED":
            return world
        if status == "FAILED":
            raise RuntimeError(f"世界重建失败：{world}")
        time.sleep(5)

    raise TimeoutError(f"世界重建仍未结束：worldId={world_id}")
```

需要检索已有世界时，可使用 `POST /world/v1/list`，通过 `pageNum`、`pageSize`、`statusList` 分页及筛选。

### 3.3 世界生成：文案或单图驱动

`POST /world/v1/generations` 可接收 `prompt`、一张 `img`，或两者组合，生成可漫游世界；状态同样通过 `GET /world/v1/{worldId}` 查询。该能力的室内效果较好，非室内场景仍处于 Beta 阶段。使用单图时，应先按 3.1 节上传并取得现有资料 URL；本现有资料未给出生成请求及响应的完整封装样例，接入代码应以实际接口定义为准。

### 3.4 《塞得下吗》的应用位置

****[规划/未落地]** **采集游戏内仓库的实拍多视角影像，满足至少 20 张、覆盖不同角度的图片要求后，调用世界重建生成可漫游的 3D 场景。该场景拟用于关卡选仓时的可视化预览，以及赛后展示用的数字展厅。此处描述的是拟接入方案，**不表示作品当前已完成仓库重建或上线相应功能**。

## 4 云端渲染（渲染云）

### 4.1 REST 离屏渲染

渲染云通过 `POST /rendercloud/v1/jobs` 提交离屏任务，将 OpenUSD 场景描述渲染为图片或视频，以减少本地 GPU 渲染负担。核心输入如下：

| 输入 | 作用 |
|---|---|
| `requestId` | 每个任务均需提供，用于幂等与追踪 |
| `usdContent` | **USDA 文本的 Base64 编码值**；USDA 可描述相机、灯光、几何和材质 |
| `fastUpload` | 设为 `true` 时使用快速上传通道 |

Mesh 可先上传、解析后再使用；具体解析接口不在本现有资料范围内。任务提交、取得实际响应中的任务标识、查询任务、获取成品，是离线出图出片的逻辑流程；但**本现有资料未提供渲染任务状态查询端点、状态枚举或结果字段**，因此不能指定一个未经证实的轮询 URL。

下例可直接运行，完成 USDA 编码与任务提交。若接入方已从实际接口资料确认状态查询 URL，可通过环境变量提供查询地址模板并启用轮询；脚本只打印查询响应，不假定成功状态或成品字段。

```python
# submit_render.py
# 用法：
#   pip install requests
#   export AHOLO_API_HEADERS_JSON='{"你的鉴权头名":"你的鉴权值"}'
#   python submit_render.py ./scene.usda
#
# 可选：确认实际查询接口后设置
#   export AHOLO_RENDER_STATUS_URL_TEMPLATE='实际URL，使用{requestId}作占位符'

import base64
import json
import os
import sys
import time
import uuid
from pathlib import Path

import requests

api_base = os.getenv("AHOLO_API_BASE", "https://api.aholo.cn").rstrip("/")
headers = json.loads(os.getenv("AHOLO_API_HEADERS_JSON", "{}"))
request_id = str(uuid.uuid4())
usda_bytes = Path(sys.argv[1]).read_bytes()

response = requests.post(
    f"{api_base}/rendercloud/v1/jobs",
    headers=headers,
    json={
        "requestId": request_id,
        "usdContent": base64.b64encode(usda_bytes).decode("ascii"),
        "fastUpload": True,
    },
    timeout=120,
)
response.raise_for_status()
print("requestId:", request_id)
print("提交响应:", response.json())

template = os.getenv("AHOLO_RENDER_STATUS_URL_TEMPLATE")
if template:
    for _ in range(60):
        status_url = template.format(requestId=request_id)
        result = requests.get(status_url, headers=headers, timeout=30)
        result.raise_for_status()
        print("查询响应:", result.json())
        # 按已核实的状态枚举与结果字段补充终止判断及成品下载。
        time.sleep(5)
```

以上可选轮询中的 `requestId` 占位符仅是脚本配置方式，**不表示实际查询接口必然以 `requestId` 定位任务**；应根据核实后的接口改为对应标识，并补齐成功、失败及超时处理。

### 4.2 实时渲染与离线渲染的边界

实时漫游预览走 **WebSocket**；离线出图、出片走本章所述 **REST** 任务。两条路径用途不同，本现有资料未提供 WebSocket 连接地址或消息协议，因此不编写未经验证的连接示例。

### 4.3 《塞得下吗》的应用位置

****[规划/未落地]** **将游戏关卡整理为 OpenUSD 场景，在云端离线渲染商品级宣传封面和短片，用作参赛展示现有资料，以减少对本地 GPU 渲染能力的依赖。使用“云端 3060/4090 级算力”及实现不依赖本地 CPU 的效果均**尚无本现有资料中的配置或性能证据**，需以实际资源规格和测试结果确认；不将其表述为已落地能力。

# 5. 材质与模型生成

### 5.1 群核 Lux3D 的能力范围

群核 Lux3D 是多模态 3D 生成引擎，支持图生 3D、文生 3D、多图生 3D，以及材质重绘、部件拆分、关节化动画、绑骨和动画重定向。《塞得下吗》的资产链路关注其中的**模型生成与材质处理**：生成结果不能仅凭预览图入库，还须检查 GLB 的几何、贴图及其在普通 WebGL 查看器中的表现。

Lux3D 文生 3D 支持的风格包括 `photorealistic`、`cartoon`、`anime`、`hand_painted`、`cyberpunk`、`fantasy`、`glass`。风格是 prompt 的一个约束，不应代替对物体形状的描述。

### 5.2 占位盒品类的 prompt 设计

**[规划/未落地]** 针对本次八个占位盒品类，可为每个品类分别编写英文 prompt，并统一遵循以下约束；具体品类名称及逐条 prompt 未包含在现有现有资料中，不在此虚构。

- **先描述可辨认的真实几何**：写明主体、轮廓和主要结构，避免只给抽象主题词。
- **强调占位所需的姿态**：适合堆叠的物体描述稳定底部与明确外轮廓；需要直立呈现的物体描述站姿和支撑关系。
- **排除干扰形状的装饰**：要求无多余装饰，减少与主体脱离的细小部件，便于后续判断包围盒和占位尺寸。
- **显式指定一种风格**：从 Lux3D 支持的风格中选择，而不是混用互相冲突的视觉要求。

**[规划/未落地]** 可复用的英文 prompt 结构如下，方括号均为待填写项：

```text
A [category object] with recognizable, realistic geometry.
[Describe its main silhouette and structural parts].
[Specify a stable stackable form or a clear upright standing pose].
No unnecessary decorations or detached details.
Style: [one supported Lux3D style].
```

prompt 只能约束生成意图，不能替代生成后的形状质检。

### 5.3 生成材质的 WebGL 显示问题

Lux3D 输出的 GLB 自带材质，其 PBR 材质来自 3DGS 多视角烘焙。实测产物包含 `metallicRoughnessTexture`；贴图的粗糙度通道均值仅约 `0.05`，同时存在 `metallicFactor=1.0` 的设置。在没有环境贴图的普通查看器中，这类近乎镜面的材质可能整体渲成纯黑，使几何形状看似“消失”。

因此，**GLB 可加载不等于模型可见**。检查材质时，不能只读取 `roughnessFactor`：存在 `metallicRoughnessTexture` 时，还必须检查贴图及其粗糙度通道统计。chair 案例的材质因子为 `roughnessFactor=0.9036`，并不能单凭这一数值认定最终外观具有较高粗糙度。

本项目验证过的标准 PBR 修复方向是：

| 项目 | 修复设置 |
| --- | --- |
| `metallicFactor` | `0.0` |
| `roughnessFactor` | 约 `0.52～0.72` |
| `metallicRoughnessTexture` | 移除引用 |
| 不再使用的贴图 | 清理、裁掉 |

其中，chair 写入产品时采用 `metal=0.0`、`rough=0.72`。

**[规划/未落地]** 以下是按上述已验证参数编写的 **GLB 材质修复参考实现**。它修改材质引用；随后用 `gltf-transform prune` 清理失去引用的资源。运行前须核对目标 GLB 中其他材质或用途是否仍需相关贴图。

```python
# fix_pbr.py
import sys
from pygltflib import GLTF2

source, target = sys.argv[1:3]
gltf = GLTF2().load(source)

for material in gltf.materials or []:
    pbr = material.pbrMetallicRoughness
    if pbr is None:
        continue
    pbr.metallicFactor = 0.0
    pbr.roughnessFactor = 0.72  # chair 的产品接入值；其他资产按质检结果选择
    pbr.metallicRoughnessTexture = None

gltf.save(target)
```

```bash
python fix_pbr.py MODEL.glb MODEL_pbr.glb
gltf-transform prune MODEL_pbr.glb MODEL_pbr_pruned.glb
```

材质修复后的验收对象是**实际着色渲染结果**，而不只是材质 JSON 中的数值。

# 6. 生成资产流入产品的接入链路（质检·修复·烘焙）

### 6.1 链路总览

产品通过内联的 `window.MESH_DATA` 使用模型。已验证的接入顺序为：

```text
Lux3D 生成
  → 下载 result.zip
  → 解压 MODEL.glb
  → 几何质检与软件光栅四视图质检
  → 材质检查、标准 PBR 修复
  → 减面／简化
  → 顶点量化压缩，形成 pos + idx + qscale + perm
  → 连同 dims、sq、rough、metal 等字段内联至 MESH_DATA
  → 产品回归验证
```

其中，`glb_render` 使用 NumPy 软件光栅与 z-buffer 生成四视图。四视图要采用真实着色结果检查是否跑型、糊成团或异常膨胀；顶点点云投影不能代替这一步。

### 6.2 逐关质检与处理

### 第一关：几何

从 `MODEL.glb` 读取网格、顶点和三角面数量，并计算包围盒及最长轴；记录归一化尺寸，核对物体主轴和预期占位方向。面数、包围盒只能说明数据规模与外接范围，**不能证明形状正确**。

### 第二关：材质

检查材质 JSON 中的 `metallicFactor`、`roughnessFactor` 和 `metallicRoughnessTexture` 引用，并统计所引用贴图的相关通道。此关专门防止“几何存在、材质致盲”：高金属度与极低粗糙度贴图可能让无环境贴图的查看器显示纯黑。发现该问题后，按第 5 章的标准 PBR 方案修复，并清理无用贴图。

### 第三关：着色形状

用软件光栅 z-buffer 输出四视图，观察主体轮廓、结构和遮挡后的形态。检查是否跑型、糊成团或膨胀；不能以顶点点云投影代替着色渲染。几何与材质检查通过后，仍须通过这一关才进入简化和产品编码。

### 简化与接入

对通过质检的模型减面、简化，再将顶点量化压缩为产品使用的 `pos`、`idx`、`qscale`、`perm`。同时写入归一化几何尺寸 `dims`、占位厘米数 `sq` 和材质参数等字段。简化前后须重新查看着色形状，避免减重改变可辨认轮廓。

### 6.3 chair：已验证的接入案例

| 阶段 | 实测记录 |
| --- | --- |
| 生成任务 | `taskId=8365786`；G1 文生 3D；耗时 `292s`；`status=3`，成功 |
| 交付文件 | `result.zip`，含 `MODEL.glb`（`8.1MB`）及 6 张 Raw 滤镜 PNG；另有 `textured.glb`（`13.6MB`，kujiale CDN 不签名） |
| `MODEL.glb` 几何 | 顶点 `8421`；三角面 `12000`；mesh `1` 个 |
| 尺寸 | 两跨网格 `dims=[0.4804, 0.8505, 0.5339]`；`norm_dims=[0.5649, 1.0, 0.6277]` |
| 材质检查 | material `1` 个；`mat0` 名称为 `None`；`metallicFactor=1.0`，`roughnessFactor=0.9036`。结合烘焙贴图特征，需要修复显示问题 |
| 产品材质 | `metal=0.0`、`rough=0.72` |
| 简化结果 | `chair_simplified.glb` 约 `245KB`，相对原始文件大幅减重 |

这个案例说明：只检查 `8421` 个顶点、`12000` 个三角面和合理的包围盒，无法发现材质致黑；只检查材质，也无法保证椅子的实际轮廓正确。三关必须分别执行。

### 6.4 `MESH_DATA` 字段与压缩边界

所有产品模型内联在 `window.MESH_DATA`。单个品类的数据结构为：

```js
{
  pos,     // 压缩顶点字符串
  idx,     // 网格索引
  verts,   // 顶点数
  tris,    // 三角面数
  dims,    // 实际几何按最长边归一化后的尺寸
  sq,      // 占位厘米数
  perm,    // 轴置换
  qscale,  // 量化尺度
  rough,   // 产品使用的粗糙度
  metal,   // 产品使用的金属度
  col      // 颜色
}
```

压缩链路的已知原则是：先简化网格，再对顶点量化，将压缩结果写为 `pos` 字符串；`idx` 保留网格连接关系，`qscale` 与 `perm` 用于按产品约定恢复量化尺度和轴向。`dims` 描述最长边归一化后的实际几何比例，`sq` 描述占位厘米数，两者不可混为一项。

**协议边界：**现有现有资料未给出 `pos` 的具体字符串编码、整数位宽、量化原点、`qscale` 的精确定义或 `perm` 的排列约定。因此不能仅凭字段名生成一段并声称与现有 `MESH_DATA` 解码器兼容的编码代码。

**[规划/未落地]** 编码器接入时，应先以产品现有解码逻辑为准，完成以下往返校验，而不是自行指定 Base64、压缩库或量化位宽：

```python
# 伪代码：需替换为项目实际的 MESH_DATA 编码／解码实现
encoded = product_encode(vertices, indices, axis_permutation)
decoded_vertices, decoded_indices = product_decode(encoded)

assert len(decoded_vertices) == len(vertices)
assert len(decoded_indices) == len(indices)
assert decoded_indices == indices
assert shape_within_tolerance(decoded_vertices, vertices)
assert rendered_shape_is_correct(decoded_vertices, decoded_indices)
```

**[规划/未落地]** 以下材质检查代码可作为批处理质检的起点；贴图通道均值仍须结合 GLB 中实际引用的图像逐一统计，不能把 ZIP 内的 Raw PNG 直接认作 `metallicRoughnessTexture`。

```python
# inspect_materials.py
import sys
from pygltflib import GLTF2

gltf = GLTF2().load(sys.argv[1])

for i, material in enumerate(gltf.materials or []):
    pbr = material.pbrMetallicRoughness
    if pbr is None:
        print(i, material.name, "no metallic-roughness block")
        continue

    mr = pbr.metallicRoughnessTexture
    print({
        "material": i,
        "name": material.name,
        "metallicFactor": pbr.metallicFactor,
        "roughnessFactor": pbr.roughnessFactor,
        "metallicRoughnessTexture": None if mr is None else mr.index,
    })
```

### 6.5 产品回归

资产写入对应品类的 `MESH_DATA` 后，完成以下已采用的回归检查：

1. 七个 `<script>` 块全部可编译。
2. 十六个品类键完整。
3. chair 在产品中正确渲染。

回归结论应基于**写入产品后的实际结果**，而非仅基于修复后的独立 GLB：入库过程中还经过简化、量化、轴置换与材质字段映射，任一环节都可能改变最终显示。

## 7. 8 品类 Lux3D 批量生成工程参数与实测数据

### 7.1 范围与 prompt 设计

《塞得下吗》是三人称 3D 收纳益智游戏，包含 16 个家具家电品类的装箱判定。本轮 R31 将其中 8 个占位盒品类批量重建为真实几何；第 9 个品类 `chair` 已在上一轮完成，不计入本轮的任务数、积分和资产体积合计。

本轮统一使用 Lux3D 文生 3D 的 `G1` 版本与 `photorealistic` 风格。写实风格便于辨认物件形体及其真实容积。**现有资料未提供各任务实际提交的 prompt 原文**，以下为后续编写或重生成 prompt 的原则，而非对历史请求体的转录：

- **[规划/未落地]** 明确单件物品的名称、主要结构和完整外形，避免把多个物件生成在同一资产中。
- **[规划/未落地]** 要求表面写实、无装饰纹样，优先保留影响收纳观感的主体轮廓。
- **[规划/未落地]** 明确物件姿态，例如衣柜、洗衣机竖立，桌类按使用姿态平放；对容易产生姿态歧义的品类，在 prompt 中写清朝向。
- **[规划/未落地]** 排除场景化背景、地面及地面阴影，使产物能够独立进入游戏资产管线。

### 7.2 提交参数与实测资产表

创建任务使用 `POST https://api.aholo.cn/lux3d/v1/generate/text-to-3d/task/create`；认证头为 `Authorization: <API Key>`，**不加 `Bearer`**。文生 3D 提交字段为 `version`、`prompt`、`style`，以及可选的 `name`、`img`；本轮 `style` 统一为 `photorealistic`。下表的占位盒尺寸为 `sq`，单位厘米；`dims` 是生成网格按最长轴归一化后的尺寸，**不是**装箱判定尺寸。

| 序号 | 品类 | 中文 | taskid | 占位盒 sq（cm，xyz） | 源面数 | 减面后 tris | verts | 归一化 dims（最长轴＝1） | meshdata 体积 |
|---:|---|---|---:|---|---:|---:|---:|---|---:|
| 1 | washer | 洗衣机 | 8371025 | 60×85×60 | 273290 | 11999 | 11909 | 0.754,1.0,0.6024 | 191428 B |
| 2 | wardrobe | 衣柜 | 8371028 | 120×200×60 | 192628 | 12000 | 8733 | 0.5329,1.0,0.3075 | 166028 B |
| 3 | treadmill | 跑步机 | 8371024 | 170×130×80 | 285744 | 12000 | 12112 | 0.6006,1.0,0.9979 | 193061 B |
| 4 | foldingtable | 折叠桌 | 8371027 | 120×75×60 | 434430 | 12000 | 10953 | 1.0,0.5785,0.4411 | 183789 B |
| 5 | coffeetable | 茶几 | 8371026 | 100×45×55 | 265768 | 11999 | 10292 | 1.0,0.3309,0.4318 | 178493 B |
| 6 | storagebox | 收纳箱 | 8371397 | 55×30×40 | 280682 | 11999 | 10289 | 0.9922,0.6405,1.0 | 178469 B |
| 7 | tv | 电视 | 8371396 | 130×75×15 | 277716 | 12000 | 7275 | 1.0,0.6657,0.2896 | 154364 B |
| 8 | mirror | 镜子 | 8371398 | 160×5×40 | 274930 | 11999 | 9129 | 0.4265,1.0,0.5417 | 169188 B |

`chair` 属于上一轮：其已记录结果为 8421 verts、12000 tris、`dims=(0.5649,1.0,0.6277)`，材质已修为 `rough=0.72`、`metal=0.0`。不能据此推定它使用了本轮任务或占用了本轮积分。

### 7.3 并发调度与成本

免费账号并发上限为 **5**。本轮 8 个任务分为 **5＋3 两批并发**：单任务实测约 **292 秒**，总墙钟约 **10 分钟**；按单任务耗时估算，串行约 **39 分钟**。`G1-Turbo text-to-3d` 为 **13 积分／任务**，因此本轮核算为 **8×13＝104 积分**。

查询端点为 `GET /lux3d/v1/generate/task/get?taskid=XXX`，参数名必须全小写。轮询间隔为 **10s**；已记录的状态含义为 `0` 排队、`1` 处理中、`3` 成功、`4` 失败，另有状态值 `6`。现有资料没有给出 `6` 的语义，实现中不应自行将其判作成功。

### 7.4 采集、减面、量化与材质处理

```text
Lux3D 文生 3D 任务
├─ 创建任务：version=G1，style=photorealistic，最多 5 个并发
├─ 按 taskid 轮询；成功后采集 outputs
│  ├─ outputs[0]：result.zip，COS 签名约 2h 过期，立即下载
│  └─ outputs[1]：textured.glb，CDN URL 不签名
├─ 几何转换
│  ├─ trimesh 加载 textured.glb；Scene 合并为单一网格
│  ├─ fast_simplification 减至约 12000 tris
│  ├─ fix_normals() 统一外翻
│  └─ 最长轴归一化；int16 顶点、uint16 索引、base64 输出 pos/idx
└─ 产品资产处理
   ├─ 修复标准 PBR：metal=0.0，rough≈0.72，移除 MR 贴图
   ├─ gltf-transform prune 裁掉无用贴图
   └─ 接入 makeObjSized，并回归检查着色与装箱判定
```

减面调用为 `fast_simplification.simplify(vertices, faces, target_count=12000)`。本轮源网格为约 **19.3 万～43.4 万面**，减面后约 **1.2 万 tris**，面数保留比例约 **4.2%～9.4%**。减面可能使 winding 不一致；产品材质使用 `FrontSide`，因此必须在导出前执行 `fix_normals()`，否则页面中会出现黑面或透明洞。

下面是****[规划/未落地]** 转换脚本核心实现示例**，用于说明已采用算法的调用与数据布局；它不是本轮原始脚本的逐字记录，输出字节数也不应冒充上表实测值。

```python
import base64
import numpy as np
import trimesh
import fast_simplification

loaded = trimesh.load("textured.glb")
mesh = loaded.dump(concatenate=True) if isinstance(loaded, trimesh.Scene) else loaded

vertices, faces = fast_simplification.simplify(
    mesh.vertices, mesh.faces, target_count=12000
)
mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
mesh.fix_normals()

vertices = np.asarray(mesh.vertices, dtype=np.float64)
extent = vertices.max(axis=0) - vertices.min(axis=0)
vertices = (vertices - (vertices.max(axis=0) + vertices.min(axis=0)) / 2) / extent.max()
dims = (extent / extent.max()).tolist()

qscale = 3.051944088384301e-05  # 32767 → 1.0
pos = np.clip(np.rint(vertices / qscale), -32768, 32767).astype("<i2")
idx = np.asarray(mesh.faces, dtype="<u2")

meshdata = {
    "dims": dims,
    "pos": base64.b64encode(pos.tobytes()).decode("ascii"),
    "idx": base64.b64encode(idx.tobytes()).decode("ascii"),
}
```

产品端 `makeObjSized` 会按 `sq` 将几何**非等比**铺满占位盒。因此 `dims` 影响模型观感比例，但不改变游戏用于判定的占位容积；不能拿归一化网格尺寸替代 `sq`。

Lux3D／3DGS 多视角烘焙产物的实测材质问题是：`metallicFactor=1.0`，且 `metallicRoughnessTexture` 的 roughness 通道均值仅约 **0.05**。在没有环境贴图的 WebGL 查看器中，这会使整体近似镜面且发黑，形体难以辨认。所有 Lux3D 输出均须执行标准 PBR 修复：`metal=0.0`、`rough≈0.72`、移除 `metallicRoughnessTexture`，再以 `gltf-transform prune` 裁掉无用贴图。上一轮 `chair` 的体积记录可作参照：`MODEL.glb` **8.1MB**、`textured.glb` **13.6MB**，处理后的 `simplified.glb` 约 **245KB**。

单品类转换实测约 **3.7 秒（CPU）**，8 品类串行转换 **<40 秒**。

### 7.5 meshdata 体积核算

按表逐项相加：

```text
191428 + 166028 + 193061 + 183789
+ 178493 + 178469 + 154364 + 169188
= 1414820 B
```

故本轮 **8 品类 meshdata 合计 1,414,820 B，约 1.4 MB**。这是表内 meshdata 的合计，不是原始 GLB、贴图或最终游戏包体的合计。

## 8. 全链路错误台账与复现步骤

### 8.1 错误台账

**E1｜文生 3D 提交返回 HTTP 400**

- **现象：**请求体携带 `faceCount`、`outputFormat`、`enablePbr` 时返回 HTTP 400。
- **根因：**这三个字段属于图生 3D，不属于文生 3D 的可提交字段。
- **修法：**移除三字段；文生 3D 只提交 `version`、`prompt`、`style`，以及按需使用的 `name`、`img`。
- **判据：**同一文生 3D 请求在移除三字段后成功创建任务。

**E2｜任务查询返回 HTTP 400**

- **现象：**查询参数写作 `taskId` 时返回 HTTP 400。
- **根因：**接口要求全小写的 `taskid`。
- **修法：**统一使用 `/lux3d/v1/generate/task/get?taskid=XXX`。
- **判据：**使用正确参数名可查询到对应任务状态。

**E3｜隔夜下载 `result.zip` 失败**

- **现象：**先前取得的下载链接隔夜使用时返回签名过期。
- **根因：**`outputs[0]` 是约 **2h** 有效的 COS 签名 URL。
- **修法：**任务成功后立即下载；已过期时通过 `task/list` 重新取得最新签名。
- **判据：**新签名链接可下载产物；不要把历史签名 URL 作为长期资产地址。

**E4｜直接内联 `textured.glb` 过大**

- **现象：**直接消费单个约 **13～20MB** 的 `textured.glb`，不适合产品内联。
- **根因：**原始高面数网格及贴图未经产品化压缩。
- **修法：**减至约 **1.2 万 tris**，再做顶点量化与编码。
- **判据：**本轮各品类 meshdata 落在约 **150～195KB**；逐件精确值以第 7 章表格为准。

**E5｜减面后出现黑面或透明洞**

- **现象：**页面渲染中出现黑面、透明洞。
- **根因：**减面后的法线／winding 不一致，`FrontSide` 材质只绘制正面。
- **修法：**减面完成后执行 `mesh.fix_normals()`，再导出。
- **判据：**真实着色视图中不再出现由背面剔除造成的缺面；同时检查开放边界边。

**E6｜模型整体发黑**

- **现象：**几何存在，但无环境贴图的 WebGL 查看器中形体发黑。
- **根因：**3DGS 烘焙材质 `metallicFactor=1.0`，MR 贴图 roughness 通道均值约 **0.05**。
- **修法：**设置 `metal=0.0`、`rough≈0.72`，移除 MR 贴图，并运行 `gltf-transform prune`。
- **判据：**材质属性和 MR 贴图检查通过，真实着色视图能辨认形体；不能以顶点点云截图代替着色验收。

**E7｜沙箱依赖跨调用丢失**

- **现象：**安装过的 `trimesh`、`fast-simplification` 在后续独立调用中不可用。
- **根因：**该沙箱的 pip 安装结果跨调用丢失。
- **修法：**将 `pip install` 与使用依赖的 Python 脚本写入**同一条 shell 命令**。
- **判据：**该命令内完成安装并成功导入、运行；不依赖下一次调用保留环境。

**E8｜解压和小文件 I/O 过慢**

- **现象：**在沙箱内展开大量小文件耗时明显；zip 中还有产品不用的贴图。
- **根因：**文件系统为网络挂载盘；zip 内 **6 张** Raw PBR 滤镜贴图合计约 **6MB**，对产品无用。
- **修法：**按用途只取 `textured.glb` 或 `MODEL.glb`，避免为无用文件付出解压和 I/O 成本。
- **判据：**转换输入齐备，且处理过程不以展开整包无用贴图为前提。

### 8.2 从零复现整条链路

以下命令是****[规划/未落地]** 复现脚手架**，不是已执行命令记录。实际 prompt 原文、项目文件路径、产品烘焙入口及网页测试入口未见于现有资料，须由项目维护者填入；不得用示例 prompt 宣称复现了原 taskid 的输入。

1. ****[规划/未落地]** 设置凭证、任务输入与输出目录。**不要把 API Key 写入仓库或日志。

   ```sh
   export AHOLO_API_KEY='<API Key>'
   export AHOLO_GATEWAY='https://api.aholo.cn'
   export ASSET_DIR='./lux3d-assets'
   mkdir -p "$ASSET_DIR"
   ```

2. ****[规划/未落地]** 安装依赖并在同一条 shell 命令中运行转换。**沙箱场景尤其不能把安装和调用拆成两次独立执行。

   ```sh
   python -m pip install requests numpy trimesh fast-simplification &&
   python ./convert_lux3d.py \
     --input "$ASSET_DIR/textured.glb" \
     --output "$ASSET_DIR/meshdata.json"
   ```

   `convert_lux3d.py` 为待落地的项目脚本；其核心几何处理应遵循第 7.4 节，且应输出源面数、减面后 tris／verts、`dims`、meshdata 字节数供核对。

3. ****[规划/未落地]** 提交文生 3D 任务。**用经确认的品类 prompt 替换占位文本；不得加入 E1 所列字段。批量调度器应控制最多 **5** 个在途任务，按 **5＋3** 提交本轮 8 个品类。

   ```sh
   curl -sS -X POST \
     "$AHOLO_GATEWAY/lux3d/v1/generate/text-to-3d/task/create" \
     -H "Authorization: $AHOLO_API_KEY" \
     -H 'Content-Type: application/json' \
     --data '{"version":"G1","prompt":"<填写该品类实际 prompt>","style":"photorealistic"}'
   ```

4. ****[规划/未落地]** 按返回的 `taskid` 轮询。**轮询间隔为 **10s**。`0`、`1` 继续等待，`3` 才进入采集，`4` 记录失败；对现有资料未解释的 `6`，保留响应并停止自动成功路径。

   ```sh
   curl -sS -G \
     "$AHOLO_GATEWAY/lux3d/v1/generate/task/get" \
     -H "Authorization: $AHOLO_API_KEY" \
     --data-urlencode "taskid=<任务返回的 taskid>"
   ```

5. ****[规划/未落地]** 任务成功后立即下载。**从成功响应中读取 `outputs[0]` 的 `result.zip` URL，立即保存；或读取 `outputs[1]` 的 `textured.glb` URL，直接获取转换所需 GLB。下载命令中的 URL 必须来自实际响应，不能复用过期签名。

   ```sh
   curl -fL '<实际 outputs[1] URL>' -o "$ASSET_DIR/textured.glb"
   # 如需归档 zip，在签名有效时执行：
   curl -fL '<实际 outputs[0] URL>' -o "$ASSET_DIR/result.zip"
   ```

6. ****[规划/未落地]** 转换、PBR 修复与产品烘焙。**先合并 Scene、减面、修复法线、最长轴归一化并编码 `pos/idx`；再在待交付的 GLB 材质上设置 `metal=0.0`、`rough≈0.72`、移除 MR 贴图，执行 `gltf-transform prune`。现有资料只提供了这些处理要求，**未提供项目现有的材质修复脚本、`prune` 调用命令或产品烘焙入口**；应在仓库中实现后以实际命令替换下列占位项。

   ```sh
   # **[规划/未落地]** 以下均为项目待实现入口，不是已验证的仓库命令。
   <项目材质修复命令> "$ASSET_DIR/textured.glb" "$ASSET_DIR/fixed.glb"
   <项目 gltf-transform prune 命令> "$ASSET_DIR/fixed.glb" "$ASSET_DIR/simplified.glb"
   <项目资产烘焙命令> "$ASSET_DIR/meshdata.json"
   ```

7. ****[规划/未落地]** 回归验证并留档。**对照第 7.2 节逐件记录 taskid、几何统计、meshdata 体积、材质检查结果与真实着色截图；同时运行下节的脚本、品类和拓扑检查。失败项附输入文件及复现命令，不以“任务状态成功”代替产品验收。

### 8.3 回归验证判据

- ****[规划/未落地]** 脚本可编译：**抽取交付页面的全部 `script` 块，逐块执行对应 JavaScript 语法检查；任一块报错即不通过。具体抽取与检查命令需按项目页面组织方式实现。
- ****[规划/未落地]** 品类完整：**产品品类键集合应覆盖游戏的 **16 品类**；本轮表内 **8 品类**及上一轮 `chair` 应正确映射，不得把“生成任务数”误当“游戏品类数”。
- ****[规划/未落地]** 几何统计：**逐件核对包围盒轴向比例、`dims`、verts 和 tris；以第 7.2 节实测表为本轮对照。检查 `makeObjSized` 后物件按各自 `sq` 铺满占位盒，但装箱判定仍使用游戏既有容积逻辑。
- ****[规划/未落地]** 材质统计：**检查修复后 `metallicFactor=0.0`、`roughnessFactor≈0.72`，并确认 MR 贴图已移除；修复前若需诊断，单独统计 MR 贴图 roughness 通道，不得仅凭材质参数推断贴图内容。
- ****[规划/未落地]** 真实着色验收：**保存前、后、左、右四视图，使用产品实际材质与着色路径；**顶点点云不能充当着色截图**。重点观察 E5 的缺面和 E6 的整体发黑。
- ****[规划/未落地]** 拓扑检查：**计算并记录网格表面积与开放边界边数量，检查是否存在异常破面；现有资料没有提供本轮各件表面积或开放边界边的实测数值，因此此处不设虚构阈值，发现异常须结合原始 GLB 与着色视图复核。
---

## 创作信息

| 字段 | 内容 |
|---|---|
| 智能体 | 开世Ai |
| 大模型 | 开世AI自采API接口 |
| 执笔人 | 喜算数科 |
| 本次执笔人 | 开世Ai文创智能体 |
| 文档类型 | 技术/源代码说明文档（参赛交付件） |
| 评估维度 | 技术真实性、接口完整性、可复现性、与产品架构的一致性 |
| 结论 | Lux3D 文生3D 全链路已真实跑通并产生产物（9 品类真实几何资产内联进产品）；世界重建与云端渲染给出接入方案并标注未落地，不虚构调用记录 |
| 建议 | 后续可把世界重建结果用于实景选仓预览、云端渲染用于宣传片出图，两者均为规划态，需完成接口联调后再更新本文档状态标记 |
| 定稿时间 | 202611190243 |
| 本次迭代消耗（估算） | 约 29886 tokens（正文 UTF-8 字节数÷3×1.8 估算，含 4 章并行撰写与组装） |
| 版本迭代总消耗（估算） | 约 25403 tokens（本次×1 版×0.85 累计系数） |
| 版本记录 | v1.0（202611190243）首版：4 章并行（gpt-6-sol）× 组装；对应产品 v100 |
