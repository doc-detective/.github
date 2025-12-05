[comment]: # 'test {"testId": "uppercase-conversion", "detectSteps": false}'

1. Open the app at [http://localhost:3000](http://localhost:3000).

[comment]: # 'step {"goTo": "http://localhost:3000"}'

2. Type "hello world" in the input field.

[comment]: # 'step {"find": {"selector": "#input", "click": true}}'
[comment]: # 'step {"type": "hello world"}'

3. Click **Convert to Uppercase**.

[comment]: # 'step {"find": {"selector": "button", "click": true}}'

4. You'll see **HELLO WORLD** in the output.

[comment]: # 'step {"find": "HELLO WORLD"}'
[comment]: # "test end"
