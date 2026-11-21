#!/bin/zsh
cd "${0:A:h}"
clear
echo "正在启动雪海小屋…"
echo ""
python3 tools/home_server.py --open
status=$?
if [ $status -ne 0 ]; then
  echo ""
  echo "启动没有成功。可再双击一次试试；若仍失败，把窗口里的文字发过来。"
  echo ""
  read -k1 "?按任意键关闭窗口"
fi
