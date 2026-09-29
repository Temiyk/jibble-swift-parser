func processData() {
    let threshold = Int.random(in: 1...20)
    let values = [5, 101, 84, -3, 0, 47, -52]
    var total = 0
    var index = 0

    // 1. Оператор ветвления guard-else
    guard threshold > 0 else {
        return
    }

    // 2. Цикл for
    for i in 0..<values.count {
        let item = values[i] 
        // 3. Ветвление if-else if-else
        if item > 100 {
            total += item
        } else if item > 0 {
            total += item / 2
        } else {
            total -= 1
        }
    }

    // 4. Цикл while
    while index < values.count {
        // 5. Тернарный условный оператор
        let step = (total > 50) ? 2 : 1
        index += step
    }

    

    // 6. Цикл repeat-while
    var counter = 3
    repeat {
        counter -= 1
    } while counter > 0

    // 7. Оператор множественного выбора switch-case-default
    let code = threshold % 4
    switch code {
    case 0:
        print("Категория A")
    case 1:
        print("Категория B")
    case 2:
        print("Категория C")
    default:
        print("Прочие категории")
    }
}

processData()