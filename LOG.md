## 2022-11-18

- 调整音频渐弱比例为25%

## 2022-11-17

- 优化encoder参数
- 文件夹 toWave 重命名为 toBin
- 解决bin文件生成后结尾存在爆破音问题

## 2022-11-16

- 添加alawmulaw.js文件，实现线性16-bit PCM编码为8-bit mulaw功能
- 添加bitdepth.js和audio测试文件
- 生成的.bi文件n尺寸超过 196608 Byte(192KB)时的提示
